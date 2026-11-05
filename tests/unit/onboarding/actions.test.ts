import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { current: null as { id: string } | null };
const landing = { current: "onboarding" as string | null };
vi.mock("@/lib/queries/auth", () => ({ getLanding: async () => landing.current }));
const tokens = { left: 99 };
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
vi.mock("@/lib/queries/onboarding", () => ({ createBusinessOnboarding: vi.fn(async () => "biz-1") }));
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
    expect(findLocalCompetitors).toHaveBeenCalledWith(q);
  });

  it("finish: rejects an empty tracked question before the RPC, saves a good one and goes to /app", async () => {
    user.current = { id: "u1" };
    const empty = { ...input, questions: [{ ...input.questions[0], short_text: "  " }] };
    expect(await finishAction(empty)).toEqual({ error: "invalid" });
    expect(createBusinessOnboarding).not.toHaveBeenCalled();
    await expect(finishAction(input)).rejects.toThrow("REDIRECT /app");
    expect(createBusinessOnboarding).toHaveBeenCalledWith(expect.anything(), input);
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
});
