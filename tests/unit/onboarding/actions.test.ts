import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const user = { current: null as { id: string } | null };
const landing = { current: "onboarding" as string | null };
vi.mock("@/lib/queries/auth", () => ({ getLanding: async () => landing.current }));
const tokens = { left: 99 };
const cache = new Map<string, unknown>();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ service: true }) }));
vi.mock("@/lib/queries/lookup-cache", () => ({
  getCachedLookup: vi.fn(
    async (_db: unknown, userId: string, kind: string, key: string) => cache.get(`${userId}|${kind}|${key}`) ?? null,
  ),
  putCachedLookup: vi.fn(
    async (_db: unknown, r: { user_id: string; kind: string; key: string; result: unknown }) =>
      void cache.set(`${r.user_id}|${r.kind}|${r.key}`, r.result),
  ),
}));
vi.mock("@/lib/queries/rate-limits", () => ({ takeRateToken: vi.fn(async () => tokens.left-- > 0) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: user.current } }) } }),
}));
vi.mock("@/lib/onboarding", () => ({
  readSite: vi.fn(async () => ({ status: "ok", name: "Example Ramen House", cuisine: "ramen" })),
  findLocalCompetitors: vi.fn(async () => ({
    status: "error",
    items: [],
    error: "DataForSEO 40501: raw upstream text",
  })),
}));
vi.mock("@/lib/queries/onboarding", async (actual) => ({
  ...(await actual<typeof import("@/lib/queries/onboarding")>()),
  createBusinessOnboarding: vi.fn(async () => "biz-1"),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

const { readSite, findLocalCompetitors } = await import("@/lib/onboarding");
const { createBusinessOnboarding } = await import("@/lib/queries/onboarding");
const { readSiteAction, findCompetitorsAction, finishAction } = await import("@/app/app/onboarding/actions");

const q = { cuisine: "ramen", city: "Irvine", state: "CA", domain: "exampleramen.test" };
const input = {
  business: {
    name: "Example Ramen House",
    domain: "exampleramen.test",
    cuisine: "ramen",
    city: "Irvine",
    state: "CA",
    country: "US",
    aliases: [],
  },
  competitors: [],
  questions: [
    {
      short_text: "best ramen in Irvine",
      long_text: "Long form.",
      active_form: "long" as const,
      active: true,
      location_level: "city" as const,
      country: "US",
      state: "CA",
      city: "Irvine",
      template_key: "1",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  user.current = null;
  landing.current = "onboarding";
  tokens.left = 99;
  cache.clear();
});

describe("onboarding server actions", () => {
  it("signed out: no outbound fetch, no paid Maps call, no save", async () => {
    expect(await readSiteAction("exampleramen.test")).toEqual({ status: "unreadable" });
    expect(await findCompetitorsAction(q)).toEqual({ status: "error", items: [] });
    expect(readSite).not.toHaveBeenCalled();
    expect(findLocalCompetitors).not.toHaveBeenCalled();
  });

  it("signed in: reads the site and looks up competitors, without passing raw upstream errors to the browser", async () => {
    user.current = { id: "u1" };
    expect(await readSiteAction("exampleramen.test")).toEqual({
      status: "ok",
      name: "Example Ramen House",
      cuisine: "ramen",
    });
    expect(readSite).toHaveBeenCalledWith("exampleramen.test");
    expect(await findCompetitorsAction(q)).toEqual({ status: "error", items: [] });
    // One lookup fills the shared cache with the full Maps list (≤20); onboarding shows the first 5.
    expect(findLocalCompetitors).toHaveBeenCalledWith({ ...q, limit: 20 });
  });

  it("finish: rejects an empty tracked question before the RPC, saves a good one and goes to /app", async () => {
    user.current = { id: "u1" };
    const empty = { ...input, questions: [{ ...input.questions[0], short_text: "  " }] };
    expect(await finishAction(empty)).toEqual({ error: "invalid" });
    expect(createBusinessOnboarding).not.toHaveBeenCalled();
    await expect(finishAction(input)).rejects.toThrow("REDIRECT /app");
    expect(createBusinessOnboarding).toHaveBeenCalledWith(expect.anything(), input);
  });

  // C-b (lead OK 2026-11-06): with ENABLE_CONNECTIONS on, Finish goes to the connect step when the
  // vertical has anything Recommended. Off, the vertical isn't sent (Q4: the select is behind the flag).
  describe("finish with ENABLE_CONNECTIONS", () => {
    afterEach(() => vi.unstubAllEnvs());
    const withVertical = (vertical: "restaurant" | "saas" | "other") => ({
      ...input,
      business: { ...input.business, vertical },
    });

    it.each(["restaurant", "saas"] as const)("on, %s: goes to the connect step", async (v) => {
      vi.stubEnv("ENABLE_CONNECTIONS", "true");
      user.current = { id: "u1" };
      await expect(finishAction(withVertical(v))).rejects.toThrow("REDIRECT /app/onboarding/connect");
      expect(createBusinessOnboarding).toHaveBeenCalledWith(expect.anything(), withVertical(v));
    });

    it("on, nothing Recommended (other): straight to /app", async () => {
      vi.stubEnv("ENABLE_CONNECTIONS", "true");
      user.current = { id: "u1" };
      await expect(finishAction(withVertical("other"))).rejects.toThrow(/^REDIRECT \/app$/);
    });

    it("on, no vertical sent: the restaurant default, so the connect step", async () => {
      vi.stubEnv("ENABLE_CONNECTIONS", "true");
      user.current = { id: "u1" };
      await expect(finishAction(input)).rejects.toThrow("REDIRECT /app/onboarding/connect");
    });

    it("off: /app, and a vertical in the payload is dropped", async () => {
      vi.stubEnv("ENABLE_CONNECTIONS", "false");
      user.current = { id: "u1" };
      await expect(finishAction(withVertical("saas"))).rejects.toThrow(/^REDIRECT \/app$/);
      expect(createBusinessOnboarding).toHaveBeenCalledWith(expect.anything(), input);
    });
  });

  it.each(["team", "dfy_client", "dashboard"])("a %s user gets the fallbacks: no fetch, no Maps call", async (l) => {
    user.current = { id: "u1" };
    landing.current = l;
    expect(await readSiteAction("exampleramen.test")).toEqual({ status: "unreadable" });
    expect(await findCompetitorsAction(q)).toEqual({ status: "error", items: [] });
    expect(readSite).not.toHaveBeenCalled();
    expect(findLocalCompetitors).not.toHaveBeenCalled();
  });

  it("over the limit: the same fallbacks, and no fetch or Maps call", async () => {
    user.current = { id: "u1" };
    tokens.left = 0;
    expect(await readSiteAction("exampleramen.test")).toEqual({ status: "unreadable" });
    expect(await findCompetitorsAction(q)).toEqual({ status: "error", items: [] });
    expect(readSite).not.toHaveBeenCalled();
    expect(findLocalCompetitors).not.toHaveBeenCalled();
    const { takeRateToken } = await import("@/lib/queries/rate-limits");
    expect(vi.mocked(takeRateToken).mock.calls.map((c) => c[1])).toEqual(["read_site", "maps_lookup"]);
  });

  it("an identical Maps lookup within 24 h is served from the cache: no token, no paid call", async () => {
    user.current = { id: "u1" };
    const found = { status: "ok", items: [{ name: "Example Noodle Bar", cid: "c1" }] };
    vi.mocked(findLocalCompetitors).mockResolvedValue(found as never);
    expect(await findCompetitorsAction(q)).toEqual(found);
    expect(await findCompetitorsAction({ ...q, cuisine: " Ramen ", city: "IRVINE", state: "ca" })).toEqual(found);
    expect(findLocalCompetitors).toHaveBeenCalledTimes(1);
    const { takeRateToken } = await import("@/lib/queries/rate-limits");
    expect(takeRateToken).toHaveBeenCalledTimes(1);
    expect([...cache.keys()]).toEqual(["u1|maps_lookup|ramen|irvine|CA|exampleramen.test"]);
    // Another user never sees it.
    user.current = { id: "u2" };
    await findCompetitorsAction(q);
    expect(findLocalCompetitors).toHaveBeenCalledTimes(2);
  });

  it("caches the full Maps list but shows only the top 5 in onboarding", async () => {
    user.current = { id: "u1" };
    const items = Array.from({ length: 8 }, (_, i) => ({ name: `Example Place ${i + 1}`, cid: `c${i + 1}` }));
    vi.mocked(findLocalCompetitors).mockResolvedValue({ status: "ok", items } as never);
    expect(await findCompetitorsAction(q)).toEqual({ status: "ok", items: items.slice(0, 5) });
    expect([...cache.values()]).toEqual([{ status: "ok", items }]);
  });
});
