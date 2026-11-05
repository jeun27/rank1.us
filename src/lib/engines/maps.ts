import { dfsLive } from "./dataforseo";
import { COUNTRY_NAMES, EngineError, US_STATES, arr, isObj, num, str } from "./shared";
import type { EngineDeps } from "./types";

// One maps_search item, with the field names from the DataForSEO Maps SERP docs.
export type MapsItem = { title: string; domain?: string; rating?: number; category?: string; cid: string };

export type MapsResult =
  | { status: "ok"; items: MapsItem[]; costUsd: number | null }
  | { status: "missing_keys" | "error"; items: []; error: string };

export type MapsRequest = { keyword: string; city: string; state: string; country?: string; depth?: number };

// POST /v3/serp/google/maps/live/advanced. Never throws: failures come back as a typed status.
export async function mapsSearch(req: MapsRequest, deps: EngineDeps): Promise<MapsResult> {
  if (!deps.env.DATAFORSEO_LOGIN || !deps.env.DATAFORSEO_PASSWORD)
    return { status: "missing_keys", items: [], error: "missing keys: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD" };
  const state = US_STATES[req.state.toUpperCase()];
  const country = COUNTRY_NAMES[(req.country ?? "US").toUpperCase()];
  if (!state || !country || !req.city.trim())
    return { status: "error", items: [], error: `cannot build a location for ${req.city}, ${req.state}` };
  try {
    const task = {
      keyword: req.keyword,
      location_name: `${req.city.trim()},${state},${country}`,
      language_code: "en",
      depth: req.depth ?? 20,
    };
    const { result, cost } = await dfsLive(deps, "/serp/google/maps/live/advanced", task);
    const items = arr(result.items)
      .filter(isObj)
      .filter((i) => i.type === "maps_search" && str(i.title) && str(i.cid))
      .map((i) => {
        const rating = isObj(i.rating) ? num(i.rating.value) : null;
        const domain = str(i.domain);
        const category = str(i.category);
        return {
          title: i.title as string,
          cid: i.cid as string,
          ...(domain ? { domain } : {}),
          ...(rating !== null ? { rating } : {}),
          ...(category ? { category } : {}),
        };
      });
    return { status: "ok", items, costUsd: cost };
  } catch (e) {
    return { status: "error", items: [], error: e instanceof EngineError ? e.message : String(e) };
  }
}
