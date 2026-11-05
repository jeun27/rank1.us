import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CACHE_MS, withLimits, type LookupKind, type LookupStore } from "@/app/app/onboarding/limits";

const HOUR = 3_600_000;
const t0 = new Date("2026-11-05T12:00:00Z").getTime();

// The limits take_rate_token applies (migration 0010), mirrored for the in-memory store.
const LIMITS: Record<LookupKind, { max: number; windowMs: number }[]> = {
  read_site: [{ max: 10, windowMs: HOUR }],
  maps_lookup: [
    { max: 5, windowMs: HOUR },
    { max: 20, windowMs: 24 * HOUR },
  ],
};

// One user's rate_events and lookup_cache rows, as the backend stores them.
function memoryStore() {
  const events: { kind: LookupKind; at: number }[] = [];
  const cache = new Map<string, { result: unknown; at: number }>();
  let now = t0;
  const store: LookupStore = {
    cached: async (kind, key, maxAgeMs) => {
      const hit = cache.get(`${kind}|${key}`);
      return hit && now - hit.at <= maxAgeMs ? hit.result : null;
    },
    // All windows must pass; then exactly one event is recorded.
    take: async (kind) => {
      const ok = LIMITS[kind].every(
        ({ max, windowMs }) => events.filter((e) => e.kind === kind && e.at > now - windowMs).length < max,
      );
      if (ok) events.push({ kind, at: now });
      return ok;
    },
    save: async (kind, key, result) => void cache.set(`${kind}|${key}`, { result, at: now }),
  };
  return { store, events, cache, clock: { now: () => new Date(now), advance: (ms: number) => (now += ms) } };
}

const ok = { status: "ok", items: [{ name: "Example Noodle Bar", cid: "1" }] };
const isOk = (r: { status: string }) => r.status === "ok";

describe("onboarding lookup limits (lead, 2026-11-05)", () => {
  it("are 10 site reads per hour and 5 Maps lookups per hour, 20 per day, fixed in take_rate_token", () => {
    const sql = readFileSync("supabase/migrations/20261105000010_rate_limits.sql", "utf8");
    expect(sql).toContain("(p_kind = 'read_site' and last_hour >= 10)");
    expect(sql).toContain("(p_kind = 'maps_lookup' and (last_hour >= 5 or last_day >= 20))");
    expect(sql).toContain("interval '1 hour'");
    expect(sql).toContain("interval '24 hours'");
    expect(CACHE_MS).toBe(24 * HOUR);
  });

  it("read_site: the 11th read in an hour is refused without fetching; the next hour is open again", async () => {
    const { store, clock } = memoryStore();
    const run = vi.fn(async () => ({ status: "unreadable" }));
    for (let i = 0; i < 10; i++)
      expect(await withLimits(store, "read_site", `site${i}.test`, run, isOk)).not.toBe("limited");
    expect(await withLimits(store, "read_site", "site10.test", run, isOk)).toBe("limited");
    expect(run).toHaveBeenCalledTimes(10);
    clock.advance(HOUR + 1);
    expect(await withLimits(store, "read_site", "site10.test", run, isOk)).not.toBe("limited");
  });

  it("maps: 5 per hour, and 20 per day even when spread over hours", async () => {
    const { store, clock } = memoryStore();
    const run = vi.fn(async () => ({ status: "missing_keys", items: [] }));
    for (let i = 0; i < 5; i++) await withLimits(store, "maps_lookup", `k${i}`, run, isOk);
    expect(await withLimits(store, "maps_lookup", "k5", run, isOk)).toBe("limited");
    for (let h = 1; h < 4; h++) {
      clock.advance(HOUR + 1);
      for (let i = 0; i < 5; i++)
        expect(await withLimits(store, "maps_lookup", `h${h}k${i}`, run, isOk)).not.toBe("limited");
    }
    clock.advance(HOUR + 1);
    expect(await withLimits(store, "maps_lookup", "day-21", run, isOk)).toBe("limited");
    expect(run).toHaveBeenCalledTimes(20);
  });

  it("an identical ok lookup within 24 h comes from the cache: no call, not counted", async () => {
    const { store, events, clock } = memoryStore();
    const run = vi.fn(async () => ok);
    expect(await withLimits(store, "maps_lookup", "ramen|irvine|CA|exampleramen.test", run, isOk)).toEqual(ok);
    clock.advance(23 * HOUR);
    for (let i = 0; i < 10; i++)
      expect(await withLimits(store, "maps_lookup", "ramen|irvine|CA|exampleramen.test", run, isOk)).toEqual(ok);
    expect(run).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    clock.advance(HOUR + 1);
    await withLimits(store, "maps_lookup", "ramen|irvine|CA|exampleramen.test", run, isOk);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("failed or keyless results count against the limit but are never cached", async () => {
    const { store, events, cache, clock } = memoryStore();
    const run = vi.fn(async () => ({ status: "error", items: [] }));
    await withLimits(store, "maps_lookup", "same", run, isOk);
    await withLimits(store, "maps_lookup", "same", run, isOk);
    expect(run).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(2);
    expect(cache.size).toBe(0);
  });
});
