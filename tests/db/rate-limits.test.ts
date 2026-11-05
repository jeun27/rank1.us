import { describe, expect, it } from "vitest";
import { takeRateToken } from "@/lib/queries/rate-limits";
import { anonClient, must, newUser, serviceClient } from "./helpers";

const HOUR = 3600;

describe("take_rate_token", () => {
  it("returns true under the limit and false at it", async () => {
    const user = await newUser("rate");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await takeRateToken(user.db, "read_site", 3, HOUR));
    expect(results).toEqual([true, true, true, false]);
    const rows = must(await serviceClient().from("rate_events").select("kind").eq("user_id", user.id));
    expect(rows).toHaveLength(3);
  });

  it("counts kinds separately", async () => {
    const user = await newUser("rate-kinds");
    expect(await takeRateToken(user.db, "read_site", 1, HOUR)).toBe(true);
    expect(await takeRateToken(user.db, "read_site", 1, HOUR)).toBe(false);
    expect(await takeRateToken(user.db, "maps_lookup", 1, HOUR)).toBe(true);
  });

  it("ignores events older than the window", async () => {
    const user = await newUser("rate-window");
    const old = new Date(Date.now() - 2 * HOUR * 1000).toISOString();
    must(
      await serviceClient()
        .from("rate_events")
        .insert([
          { user_id: user.id, kind: "maps_lookup", created_at: old },
          { user_id: user.id, kind: "maps_lookup", created_at: old },
        ]),
    );
    expect(await takeRateToken(user.db, "maps_lookup", 2, HOUR)).toBe(true);
    expect(await takeRateToken(user.db, "maps_lookup", 2, HOUR)).toBe(true);
    expect(await takeRateToken(user.db, "maps_lookup", 2, HOUR)).toBe(false);
  });

  it("limits each user separately", async () => {
    const a = await newUser("rate-a");
    const b = await newUser("rate-b");
    expect(await takeRateToken(a.db, "read_site", 1, HOUR)).toBe(true);
    expect(await takeRateToken(a.db, "read_site", 1, HOUR)).toBe(false);
    expect(await takeRateToken(b.db, "read_site", 1, HOUR)).toBe(true);
  });

  it("parallel calls never exceed the max", async () => {
    const user = await newUser("rate-parallel");
    const results = await Promise.all(Array.from({ length: 10 }, () => takeRateToken(user.db, "maps_lookup", 3, HOUR)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(must(await serviceClient().from("rate_events").select("kind").eq("user_id", user.id))).toHaveLength(3);
  });

  it("no user means no token: anon cannot call it, the service role gets false", async () => {
    await expect(takeRateToken(anonClient(), "read_site", 5, HOUR)).rejects.toMatchObject({ code: "42501" });
    expect(await takeRateToken(serviceClient(), "read_site", 5, HOUR)).toBe(false);
  });

  it("signed-in users cannot read or write rate_events directly", async () => {
    const user = await newUser("rate-direct");
    await takeRateToken(user.db, "read_site", 5, HOUR);
    expect(must(await user.db.from("rate_events").select("kind"))).toEqual([]);
    const { error } = await user.db.from("rate_events").insert({ user_id: user.id, kind: "read_site" });
    expect(error?.code).toBe("42501");
  });
});
