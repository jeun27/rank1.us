import { describe, expect, it } from "vitest";
import { createSiteFetcher } from "@/lib/onboarding/read-site";
import { H, site } from "./site";

describe("createSiteFetcher budget", () => {
  it("stops at maxRequests (robots counts as one) and reports exhausted", async () => {
    const s = site({ [`${H}/`]: { body: "<h1>Hi</h1>" }, [`${H}/a`]: { body: "a" }, [`${H}/b`]: { body: "b" } });
    const f = (await createSiteFetcher("example-ramen-house.test", { ...s, maxRequests: 3 }))!;
    expect(await f.page("/")).not.toBeNull();
    expect(await f.page("/a")).not.toBeNull();
    expect(await f.page("/b")).toBeNull();
    expect(f.used()).toEqual({ requests: 3, exhausted: true });
  });

  it("stops once the time budget is spent", async () => {
    let t = 0;
    const s = site({ [`${H}/`]: { body: "<h1>Hi</h1>" }, [`${H}/a`]: { body: "a" } });
    const f = (await createSiteFetcher("example-ramen-house.test", { ...s, budgetMs: 45_000, now: () => t }))!;
    expect(await f.page("/")).not.toBeNull();
    t = 45_000;
    expect(await f.page("/a")).toBeNull();
    expect(f.used().exhausted).toBe(true);
  });

  it("caches pages, refuses other hosts, and tells missing robots from failed robots", async () => {
    const s = site({ [`${H}/`]: { body: "<h1>Hi</h1>" } });
    const f = (await createSiteFetcher("example-ramen-house.test", s))!;
    await f.page("/");
    await f.page("/#top");
    expect(s.fetch.mock.calls.filter((c) => String(c[0]) === `${H}/`)).toHaveLength(1);
    expect(await f.page("https://example-other.test/")).toBeNull();
    expect(f.robots.status).toBe("missing");
    const down = (await createSiteFetcher("example-ramen-house.test", site({ [`${H}/robots.txt`]: "throw" })))!;
    expect(down.robots.status).toBe("error");
    expect(
      (await createSiteFetcher("example-ramen-house.test", site({ [`${H}/robots.txt`]: { status: 503 } })))!.robots
        .status,
    ).toBe("error");
  });
});
