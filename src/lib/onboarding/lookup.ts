import { findLocalCompetitors } from "./competitors";
import { withLimits, type LookupStore } from "./limits";
import type { FindLocalCompetitorsInput, LocalCompetitorsResult } from "./types";

// One paid Maps lookup serves onboarding (first 5) and the Competitors page (the rest), cached 24 h.
export const MAPS_CACHE_LIMIT = 20;

export type CompetitorList = Omit<LocalCompetitorsResult, "error">;
export type CompetitorLookup = Omit<FindLocalCompetitorsInput, "limit"> & { domain: string };

export const competitorCacheKey = (q: CompetitorLookup) =>
  [q.cuisine.trim().toLowerCase(), q.city.trim().toLowerCase(), q.state.trim().toUpperCase(), q.domain].join("|");

// The full Maps list (≤20, Maps order) through the cache + maps_lookup token; "limited" when over it.
// The upstream error text is dropped here, so it never reaches a browser.
export function lookupCompetitors(
  store: LookupStore,
  q: CompetitorLookup,
  find: typeof findLocalCompetitors = findLocalCompetitors,
): Promise<CompetitorList | "limited"> {
  return withLimits(
    store,
    "maps_lookup",
    competitorCacheKey(q),
    async (): Promise<CompetitorList> => {
      const { status, items } = await find({ ...q, limit: MAPS_CACHE_LIMIT });
      return { status, items };
    },
    (x) => x.status === "ok",
  );
}
