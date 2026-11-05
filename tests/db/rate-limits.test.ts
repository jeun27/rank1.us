import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedLookup, putCachedLookup } from "@/lib/queries/lookup-cache";
import { takeRateToken, type RateKind } from "@/lib/queries/rate-limits";
import { anonClient, must, newUser, serviceClient } from "./helpers";

const HOUR_MS = 3600 * 1000;
const loose = (db: unknown) => db as SupabaseClient;

async function take(db: Parameters<typeof takeRateToken>[0], kind: RateKind, times: number) {
  const results: boolean[] = [];
  for (let i = 0; i < times; i++) results.push(await takeRateToken(db, kind));
  return results;
}

// Events written as the service role, `hoursAgo` in the past.
async function pastEvents(userId: string, kind: RateKind, count: number, hoursAgo: number) {
  const created_at = new Date(Date.now() - hoursAgo * HOUR_MS).toISOString();
  must(
    await serviceClient()
      .from("rate_events")
      .insert(Array.from({ length: count }, () => ({ user_id: userId, kind, created_at }))),
  );
}

const events = async (userId: string, kind: RateKind) =>
  must(await serviceClient().from("rate_events").select("created_at").eq("user_id", userId).eq("kind", kind));

describe("take_rate_token", () => {
  it("read_site allows 10 per hour", async () => {
    const user = await newUser("rate-read");
    expect(await take(user.db, "read_site", 11)).toEqual([...Array(10).fill(true), false]);
    expect(await events(user.id, "read_site")).toHaveLength(10);
  });

  it("maps_lookup allows 5 per hour", async () => {
    const user = await newUser("rate-maps-hour");
    expect(await take(user.db, "maps_lookup", 6)).toEqual([...Array(5).fill(true), false]);
  });

  it("maps_lookup allows 20 per 24 hours even when the last hour is quiet", async () => {
    const user = await newUser("rate-maps-day");
    await pastEvents(user.id, "maps_lookup", 18, 2);
    expect(await take(user.db, "maps_lookup", 3)).toEqual([true, true, false]);
  });

  it("events older than an hour do not count toward the hourly limit", async () => {
    const user = await newUser("rate-window");
    await pastEvents(user.id, "read_site", 10, 2);
    expect(await takeRateToken(user.db, "read_site")).toBe(true);
  });

  it("prunes this user's events of that kind older than 24 hours", async () => {
    const user = await newUser("rate-prune");
    const other = await newUser("rate-prune-other");
    await pastEvents(user.id, "maps_lookup", 25, 25);
    await pastEvents(user.id, "read_site", 2, 25);
    await pastEvents(other.id, "maps_lookup", 2, 25);

    expect(await takeRateToken(user.db, "maps_lookup")).toBe(true);
    expect(await events(user.id, "maps_lookup")).toHaveLength(1);
    expect(await events(user.id, "read_site")).toHaveLength(2);
    expect(await events(other.id, "maps_lookup")).toHaveLength(2);
  });

  it("counts kinds separately", async () => {
    const user = await newUser("rate-kinds");
    await take(user.db, "maps_lookup", 5);
    expect(await takeRateToken(user.db, "maps_lookup")).toBe(false);
    expect(await takeRateToken(user.db, "read_site")).toBe(true);
  });

  it("limits each user separately", async () => {
    const a = await newUser("rate-a");
    const b = await newUser("rate-b");
    await take(a.db, "maps_lookup", 5);
    expect(await takeRateToken(a.db, "maps_lookup")).toBe(false);
    expect(await takeRateToken(b.db, "maps_lookup")).toBe(true);
  });

  it("parallel calls never exceed the limit", async () => {
    const user = await newUser("rate-parallel");
    const results = await Promise.all(Array.from({ length: 12 }, () => takeRateToken(user.db, "maps_lookup")));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await events(user.id, "maps_lookup")).toHaveLength(5);
  });

  it("rejects an unknown kind with 22023", async () => {
    const user = await newUser("rate-unknown");
    const { error } = await loose(user.db).rpc("take_rate_token", { p_kind: "anything" });
    expect(error?.code).toBe("22023");
  });

  it("callers cannot pass their own limits", async () => {
    const user = await newUser("rate-params");
    const { error } = await loose(user.db).rpc("take_rate_token", {
      p_kind: "read_site",
      p_max: 1000,
      p_window: "1 second",
    });
    expect(error).not.toBeNull();
    expect(await events(user.id, "read_site")).toEqual([]);
  });

  it("no user means no token: anon cannot call it, the service role gets false", async () => {
    await expect(takeRateToken(anonClient(), "read_site")).rejects.toMatchObject({ code: "42501" });
    expect(await takeRateToken(serviceClient(), "read_site")).toBe(false);
  });

  it("signed-in users cannot read or write rate_events directly", async () => {
    const user = await newUser("rate-direct");
    await takeRateToken(user.db, "read_site");
    expect(must(await user.db.from("rate_events").select("kind"))).toEqual([]);
    const { error } = await user.db.from("rate_events").insert({ user_id: user.id, kind: "read_site" });
    expect(error?.code).toBe("42501");
  });
});

describe("lookup_cache", () => {
  const DAY = 24 * 3600;
  const result = { name: "Example Ramen House", cuisine: "ramen", status: "ok" };

  it("returns a stored result within its max age, for that user, kind and key only", async () => {
    const user = await newUser("cache");
    const other = await newUser("cache-other");
    const s = serviceClient();
    await putCachedLookup(s, { user_id: user.id, kind: "read_site", key: "example-ramen.test", result });

    expect(await getCachedLookup(s, user.id, "read_site", "example-ramen.test", DAY)).toEqual(result);
    expect(await getCachedLookup(s, user.id, "read_site", "other.test", DAY)).toBeNull();
    expect(await getCachedLookup(s, user.id, "maps_lookup", "example-ramen.test", DAY)).toBeNull();
    expect(await getCachedLookup(s, other.id, "read_site", "example-ramen.test", DAY)).toBeNull();
  });

  it("ignores results older than the max age, and an upsert refreshes the age", async () => {
    const user = await newUser("cache-age");
    const s = serviceClient();
    const old = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    must(
      await s.from("lookup_cache").insert({ user_id: user.id, kind: "maps_lookup", key: "k", result, created_at: old }),
    );
    expect(await getCachedLookup(s, user.id, "maps_lookup", "k", DAY)).toBeNull();

    const fresh = { ...result, name: "Example Fresh" };
    await putCachedLookup(s, { user_id: user.id, kind: "maps_lookup", key: "k", result: fresh });
    expect(await getCachedLookup(s, user.id, "maps_lookup", "k", DAY)).toEqual(fresh);
    expect(must(await s.from("lookup_cache").select("key").eq("user_id", user.id))).toHaveLength(1);
  });

  it("signed-in users and anon cannot read or write it", async () => {
    const user = await newUser("cache-direct");
    await putCachedLookup(serviceClient(), { user_id: user.id, kind: "read_site", key: "k", result });
    for (const db of [user.db, anonClient()]) {
      const read = await loose(db).from("lookup_cache").select("*");
      expect(read.error?.code ?? "").toBe("42501");
      const write = await loose(db)
        .from("lookup_cache")
        .insert({ user_id: user.id, kind: "read_site", key: "x", result });
      expect(write.error?.code).toBe("42501");
    }
  });
});
