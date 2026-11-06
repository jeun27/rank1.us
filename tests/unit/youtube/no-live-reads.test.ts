import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// #150 review S1: rendering the Fix list and the Connections hub makes no YouTube call. They read what the
// weekly pass stored (each R19–R21 fix's evidence) and the business's cuisine. The only live YouTube call
// left is the channel picker during connect.
vi.mock("server-only", () => ({}));
const yt = vi.hoisted(() => ({ listMyChannels: vi.fn(), listRecentVideos: vi.fn() }));
vi.mock("@/lib/connections/youtube", () => yt);
const svc = vi.hoisted(() => ({ loadYoutubeChecklist: vi.fn() }));
vi.mock("@/lib/connections/service", async (actual) => ({ ...(await actual<object>()), ...svc }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/queries/connections", async (actual) => ({
  ...(await actual<object>()),
  getBusinessVertical: async () => "restaurant",
  listConnections: async () => [{ id: "y1", provider: "youtube", status: "connected", selected_entities: [] }],
  listConnectorInterest: async () => [],
  listConnectionChanges: async () => [],
  canConnectBusiness: async () => true,
}));

const cuisine = { current: null as string | null };
const rows = {
  current: [
    {
      id: "f19",
      rule_key: "R19",
      evidence: { videos: [{ id: "a", title: "T", url: "https://www.youtube.com/watch?v=a" }, { id: 5 }] },
    },
    { id: "f21", rule_key: "R21", evidence: { reason: "no_videos" } },
  ],
};
// A tiny fake of the user's Supabase client: businesses (cuisine) and fixes (evidence).
const db = {
  from: (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      in: () => q,
      maybeSingle: async () => ({ data: { cuisine: cuisine.current }, error: null }),
      then: (ok: (r: unknown) => unknown) => ok({ data: table === "fixes" ? rows.current : [], error: null }),
    };
    return q;
  },
} as never;

const { loadHub } = await import("@/components/connections/load");
const { loadYoutubeFixVideos } = await import("@/components/youtube/load");

beforeEach(() => vi.clearAllMocks());

describe("no live YouTube reads while rendering", () => {
  it("the hub: no YouTube call; no keyword comes from the business's cuisine", async () => {
    cuisine.current = null;
    expect((await loadHub(db, "biz-1", "/app/settings/connections", {})).youtubeNoKeyword).toBe(true);
    cuisine.current = "ramen";
    expect((await loadHub(db, "biz-1", "/app/settings/connections", {})).youtubeNoKeyword).toBe(false);
    expect(yt.listMyChannels).not.toHaveBeenCalled();
    expect(yt.listRecentVideos).not.toHaveBeenCalled();
    expect(svc.loadYoutubeChecklist).not.toHaveBeenCalled();
  });

  it("the Fix list: the stored evidence per rule, only well-formed videos, and no YouTube call", async () => {
    vi.stubEnv("ENABLE_CONNECTIONS", "true");
    cuisine.current = "ramen";
    expect(await loadYoutubeFixVideos(db, "biz-1", ["R19", "R21"])).toEqual({
      keyword: "ramen",
      byRule: { R19: [{ id: "a", title: "T", url: "https://www.youtube.com/watch?v=a" }] },
    });
    expect(await loadYoutubeFixVideos(db, "biz-1", ["R10"])).toBeNull();
    vi.stubEnv("ENABLE_CONNECTIONS", "false");
    expect(await loadYoutubeFixVideos(db, "biz-1", ["R19"])).toBeNull();
    vi.unstubAllEnvs();
    expect(yt.listMyChannels).not.toHaveBeenCalled();
    expect(yt.listRecentVideos).not.toHaveBeenCalled();
    expect(svc.loadYoutubeChecklist).not.toHaveBeenCalled();
  });

  it("the page and hub loaders don't import the live checklist", () => {
    for (const f of [
      "src/app/app/fixes/page.tsx",
      "src/components/connections/load.ts",
      "src/components/youtube/load.ts",
    ])
      expect(readFileSync(f, "utf8"), f).not.toMatch(/loadYoutubeChecklist|@\/lib\/connections\/youtube/);
  });
});
