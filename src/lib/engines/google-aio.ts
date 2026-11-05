import { dfsLive } from "./dataforseo";
import {
  COUNTRY_NAMES,
  DFS_COUNTRY_CODES,
  EngineError,
  arr,
  isObj,
  settle,
  stateName,
  str,
  toCitations,
  type Adapter,
} from "./shared";
import type { EngineRequest } from "./types";

// location_name in the docs' format, e.g. "Irvine,California,United States".
export function aioLocation({
  location: l,
}: EngineRequest): { location_code: number } | { location_name: string } | null {
  if (l.dfsLocationCode) return { location_code: l.dfsLocationCode };
  const country = COUNTRY_NAMES[l.country.toUpperCase()];
  if (!country) return null;
  if (l.level === "country") return { location_code: DFS_COUNTRY_CODES[l.country.toUpperCase()] };
  const state = stateName(l.state);
  if (!state || (l.level === "city" && !l.city)) return null;
  return { location_name: [l.level === "city" ? l.city : null, state, country].filter(Boolean).join(",") };
}

export const googleAio: Adapter = (req, deps) => {
  const location = aioLocation(req);
  const used = !location
    ? ""
    : "location_code" in location
      ? `location_code:${location.location_code}`
      : location.location_name;
  return settle(deps, { locationUsed: used, locationSupported: "exact" }, async () => {
    if (!location) throw new EngineError(`cannot build a DataForSEO location for ${JSON.stringify(req.location)}`);
    const task = { keyword: req.question, ...location, language_code: "en", load_async_ai_overview: true };
    const { json, result, cost } = await dfsLive(deps, "/serp/google/organic/live/advanced", task);
    const aio = arr(result.items).find((i) => isObj(i) && i.type === "ai_overview");
    if (!isObj(aio)) return { status: "no_overview", text: null, citations: [], costUsd: cost, raw: json };
    const elements = arr(aio.items).filter(isObj);
    const top = arr(aio.references);
    const refs = top.length ? top : elements.flatMap((e) => arr(e.references));
    const text =
      str(aio.markdown) ??
      (elements
        .map((e) => str(e.text))
        .filter(Boolean)
        .join("\n\n") ||
        null);
    return { status: "ok", text, citations: toCitations(refs), costUsd: cost, raw: json };
  });
};
