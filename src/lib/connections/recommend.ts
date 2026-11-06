import type { ConnectorKey } from "@/lib/queries/connections";
import { VERTICALS, type Vertical } from "@/lib/queries/onboarding";

// Industry → connector recommendations (founder map, 2026-11-06), keyed by backend's connector list (0021).
// ONE table: the hub, the onboarding step and the dashboard card all read it. Tiers: recommended, optional, later ("Optional later" → Coming soon).
// Industries not listed for a connector don't see its tile.
// The industry is businesses.vertical (backend's VERTICALS, one list).
export const INDUSTRIES = VERTICALS;
export type Industry = Vertical;

// Copy keys for the niche helper text on each tile (strings live in COPY.md, not here).
export type Niche =
  "local" | "restaurant_booking" | "site" | "dtc_store" | "dtc_amazon" | "saas_reviews" | "ai_referrals" | "video";

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
const not = (list: Industry[], ...out: Industry[]) => list.filter((i) => !out.includes(i));

type Rule = { niche: Niche; recommended?: Industry[]; optional?: Industry[]; later?: Industry[] };

// Order = display order inside a tier. 'other' (incl. med-spa) gets no recommendation; it can still
// connect the live Google connectors from Settings.
export const CONNECTORS = {
  gbp: { niche: "local", recommended: LOCAL, optional: ["other"] },
  site_cms: { niche: "site", recommended: ["saas", "dtc", "events"], optional: not(LOCAL, "events") },
  search_console: { niche: "site", recommended: ["saas", "dtc"], optional: [...LOCAL, "other"] },
  shopify: { niche: "dtc_store", recommended: ["dtc"] },
  g2_capterra: { niche: "saas_reviews", recommended: ["saas"] },
  ga4: { niche: "ai_referrals", optional: ["saas", "dtc", "other"] },
  opentable: { niche: "restaurant_booking", optional: ["restaurant"] },
  resy: { niche: "restaurant_booking", optional: ["restaurant"] },
  apple_business_connect: { niche: "local", later: LOCAL },
  bing_places: { niche: "local", later: LOCAL },
  yelp: { niche: "local", later: LOCAL },
  amazon: { niche: "dtc_amazon", later: ["dtc"] },
  // G1 (GAS-Q3): Recommended for saas + dtc, Optional for everyone else; read-only (GAS-Q4).
  youtube: { niche: "video", recommended: ["saas", "dtc"], optional: [...LOCAL, "other"] },
} as const satisfies Record<ConnectorKey, Rule>;
export type Connector = ConnectorKey;

// Only these have a working flow; every other tile is "Coming soon" + Notify me (no fake connect buttons).
// youtube joins once frontend's tile + consent ship (G1); that also adds it to saas/dtc readiness.
export const LIVE_CONNECTORS: readonly string[] = ["gbp", "search_console", "ga4"];

export type Tile = { connector: Connector; niche: Niche; available: "live" | "coming_soon" };
export type Recommendations = { recommended: Tile[]; optional: Tile[]; later: Tile[] };

export function recommend(industry: Industry): Recommendations {
  const out: Recommendations = { recommended: [], optional: [], later: [] };
  for (const [connector, rule] of Object.entries(CONNECTORS) as [Connector, Rule][]) {
    const tier = (["recommended", "optional", "later"] as const).find((t) => rule[t]?.includes(industry));
    if (!tier) continue;
    out[tier].push({
      connector,
      niche: rule.niche,
      available: tier !== "later" && LIVE_CONNECTORS.includes(connector) ? "live" : "coming_soon",
    });
  }
  return out;
}

// G3 "Ready for GAS" (lead B1): the Recommended connectors with a live connect flow. Coming-soon ones
// never block readiness and join automatically once live. Pass this to refreshGasReady; empty = never ready.
export function readinessSet(industry: Industry): Connector[] {
  return recommend(industry)
    .recommended.filter((t) => t.available === "live")
    .map((t) => t.connector);
}
