import { describe, expect, it, vi } from "vitest";
import { CACHE_MS, LIMITS, withLimits, type LookupKind, type LookupStore } from "@/app/app/onboarding/limits";

const HOUR = 3_600_000;
const t0 = new Date("2026-11-05T12:00:00Z").getTime();

// One user's rows, as onboarding_lookups would hold them.
function memoryStore() {
  const rows: { kind: LookupKind; key: string; result: unknown; at: number }[] = [];
  let now = t0;
  const store: LookupStore = {
    count: async (kind, since) => rows.filter((r) => r.kind === kind && r.at >= since.getTime()).length,
    cached: async (kind, key, since) =>
      rows.filter((r) => r.kind === kind && r.key === key && r.result !== null && r.at >= since.getTime()).at(-1)
        ?.result ?? null,
    record: async (kind, key, result) => void rows.push({ kind, key, result, at: now }),
  };
  return { store, rows, clock: { now: () => new Date(now), advance: (ms: number) => (now += ms) } };
}

const ok = { status: "ok", items: [{ name: "Example Noodle Bar", cid: "1" }] };
const isOk = (r: { status: string }) => r.status === "ok";

describe("onboarding lookup limits (lead, 2026-11-05)", () => {
  it("are 10 site reads per hour and 5 Maps lookups per hour, 20 per day", () => {
    expect(LIMITS).toEqual({
      read_site: [{ max: 10, windowMs: HOUR }],
      maps: [
        { max: 5, windowMs: HOUR },
        { max: 20, windowMs: 24 * HOUR },
      ],
    });
    expect(CACHE_MS).toBe(24 * HOUR);
  });

  it("read_site: the 11th read in an hour is refused without fetching; the next hour is open again", async () => {
    const { store, clock } = memoryStore();
    const run = vi.fn(async () => ({ status: "unreadable" }));
    for (let i = 0; i < 10; i++)
      expect(await withLimits(store, "read_site", `site${i}.test`, clock.now(), run, isOk)).not.toBe("limited");
    expect(await withLimits(store, "read_site", "site10.test", clock.now(), run, isOk)).toBe("limited");
    expect(run).toHaveBeenCalledTimes(10);
    clock.advance(HOUR + 1);
    expect(await withLimits(store, "read_site", "site10.test", clock.now(), run, isOk)).not.toBe("limited");
  });

  it("maps: 5 per hour, and 20 per day even when spread over hours", async () => {
    const { store, clock } = memoryStore();
    const run = vi.fn(async () => ({ status: "missing_keys", items: [] }));
    for (let i = 0; i < 5; i++) await withLimits(store, "maps", `k${i}`, clock.now(), run, isOk);
    expect(await withLimits(store, "maps", "k5", clock.now(), run, isOk)).toBe("limited");
    for (let h = 1; h < 4; h++) {
      clock.advance(HOUR + 1);
      for (let i = 0; i < 5; i++)
        expect(await withLimits(store, "maps", `h${h}k${i}`, clock.now(), run, isOk)).not.toBe("limited");
    }
    clock.advance(HOUR + 1);
    expect(await withLimits(store, "maps", "day-21", clock.now(), run, isOk)).toBe("limited");
    expect(run).toHaveBeenCalledTimes(20);
  });

  it("an identical ok lookup within 24 h comes from the cache: no call, not counted", async () => {
    const { store, rows, clock } = memoryStore();
    const run = vi.fn(async () => ok);
    expect(await withLimits(store, "maps", "ramen|irvine|CA|exampleramen.test", clock.now(), run, isOk)).toEqual(ok);
    clock.advance(23 * HOUR);
    for (let i = 0; i < 10; i++)
      expect(await withLimits(store, "maps", "ramen|irvine|CA|exampleramen.test", clock.now(), run, isOk)).toEqual(ok);
    expect(run).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    clock.advance(HOUR + 1);
    await withLimits(store, "maps", "ramen|irvine|CA|exampleramen.test", clock.now(), run, isOk);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("failed or keyless results count against the limit but are never cached", async () => {
    const { store, rows, clock } = memoryStore();
    const run = vi.fn(async () => ({ status: "error", items: [] }));
    await withLimits(store, "maps", "same", clock.now(), run, isOk);
    await withLimits(store, "maps", "same", clock.now(), run, isOk);
    expect(run).toHaveBeenCalledTimes(2);
    expect(rows.map((r) => r.result)).toEqual([null, null]);
  });
});
