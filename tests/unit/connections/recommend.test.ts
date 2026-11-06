import { describe, expect, it } from "vitest";
import { CONNECTORS, INDUSTRIES, LIVE_CONNECTORS, recommend, type Industry } from "@/lib/connections/recommend";

const ids = (tiles: { connector: string }[]) => tiles.map((t) => t.connector).sort();
const LOCAL: Industry[] = [
  "restaurant",
  "hvac",
  "plumbing",
  "roofing",
  "pest_control",
  "auto",
  "beauty",
  "gym",
  "events",
  "dental",
];

// The founder's connector map (2026-11-06), one row per industry.
const EXPECTED: Record<Industry, { recommended: string[]; optional: string[]; later: string[] }> = {
  restaurant: {
    recommended: ["gbp"],
    optional: ["opentable", "resy", "search_console", "site_cms", "youtube"],
    later: ["apple_business_connect", "bing_places", "yelp"],
  },
  ...Object.fromEntries(
    (["hvac", "plumbing", "roofing", "pest_control", "auto", "beauty", "gym", "dental"] as const).map((i) => [
      i,
      {
        recommended: ["gbp"],
        optional: ["search_console", "site_cms", "youtube"],
        later: ["apple_business_connect", "bing_places", "yelp"],
      },
    ]),
  ),
  events: {
    recommended: ["gbp", "site_cms"],
    optional: ["search_console", "youtube"],
    later: ["apple_business_connect", "bing_places", "yelp"],
  },
  saas: {
    // G1 (lead): YouTube is Optional everywhere.
    recommended: ["g2_capterra", "search_console", "site_cms"],
    optional: ["ga4", "youtube"],
    later: [],
  },
  dtc: {
    recommended: ["search_console", "shopify", "site_cms"],
    optional: ["ga4", "youtube"],
    later: ["amazon"],
  },
  other: { recommended: [], optional: ["ga4", "gbp", "search_console", "youtube"], later: [] },
} as unknown as Record<Industry, { recommended: string[]; optional: string[]; later: string[] }>;

describe("recommend (industry → connectors)", () => {
  it.each(INDUSTRIES)("%s matches the founder's map", (industry) => {
    const r = recommend(industry);
    expect(ids(r.recommended)).toEqual([...EXPECTED[industry].recommended].sort());
    expect(ids(r.optional)).toEqual([...EXPECTED[industry].optional].sort());
    expect(ids(r.later)).toEqual([...EXPECTED[industry].later].sort());
  });

  it("GBP is recommended to every local niche and to no online-only one", () => {
    for (const i of LOCAL) expect(ids(recommend(i).recommended)).toContain("gbp");
    for (const i of ["saas", "dtc", "other"] as const) expect(ids(recommend(i).recommended)).not.toContain("gbp");
  });

  it("med-spa isn't an industry; it falls under other, which has nothing recommended", () => {
    expect(INDUSTRIES).not.toContain("med_spa");
    expect(recommend("other").recommended).toEqual([]);
  });

  it("a restaurant never sees Shopify, G2, Amazon or GA4", () => {
    const all = Object.values(recommend("restaurant")).flatMap(ids);
    for (const c of ["shopify", "g2_capterra", "amazon", "ga4"]) expect(all).not.toContain(c);
  });

  it("each tile appears in one tier at most, carries a niche, and only Google connectors are live", () => {
    for (const i of INDUSTRIES) {
      const r = recommend(i);
      const all = [...r.recommended, ...r.optional, ...r.later];
      expect(new Set(all.map((t) => t.connector)).size).toBe(all.length);
      for (const t of all) {
        expect(t.niche).toBeTruthy();
        expect(t.available).toBe(LIVE_CONNECTORS.includes(t.connector) ? "live" : "coming_soon");
      }
      // "later" tiles are never connectable yet.
      for (const t of r.later) expect(t.available).toBe("coming_soon");
    }
    expect([...LIVE_CONNECTORS].sort()).toEqual(["ga4", "gbp", "search_console", "youtube"]);
    expect(Object.keys(CONNECTORS).sort()).toEqual(
      [
        "gbp",
        "apple_business_connect",
        "bing_places",
        "yelp",
        "opentable",
        "resy",
        "site_cms",
        "shopify",
        "amazon",
        "g2_capterra",
        "search_console",
        "ga4",
        "youtube",
      ].sort(),
    );
  });

  it("tiles keep the config order, so the hub is stable", () => {
    expect(recommend("saas")).toEqual(recommend("saas"));
    const order = Object.keys(CONNECTORS);
    for (const tier of Object.values(recommend("restaurant"))) {
      const pos = tier.map((t) => order.indexOf(t.connector));
      expect(pos).toEqual([...pos].sort((a, b) => a - b));
    }
  });
});

// G1 (lead 2026-11-06): YouTube is Optional for every vertical (no cuisine keyword to check saas/dtc yet), so
// it never blocks G3 readiness.
describe("YouTube", () => {
  it.each(INDUSTRIES)("%s: Optional and live, never Recommended", (i) => {
    const r = recommend(i);
    expect(r.optional.map((t) => t.connector)).toContain("youtube");
    expect(r.recommended.map((t) => t.connector)).not.toContain("youtube");
    expect(r.optional.find((t) => t.connector === "youtube")?.available).toBe("live");
  });
});
