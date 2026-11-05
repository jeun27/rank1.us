import "server-only";
import { mapsSearch } from "@/lib/engines/maps";
import type { EngineDeps } from "@/lib/engines/types";
import type { FindLocalCompetitorsInput, LocalCompetitorsResult } from "./types";

export const MAX_SUGGESTED_COMPETITORS = 5;

export const bareDomain = (d: string) =>
  d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^www\./, "");

// Top 5 "{cuisine} restaurant" results in Google Maps order (no re-ranking), the business itself excluded.
export async function findLocalCompetitors(
  input: FindLocalCompetitorsInput,
  deps: Partial<EngineDeps> = {},
): Promise<LocalCompetitorsResult> {
  const res = await mapsSearch(
    { keyword: `${input.cuisine.trim()} restaurant`.trim(), city: input.city, state: input.state },
    {
      fetch: deps.fetch ?? fetch,
      env: deps.env ?? process.env,
      now: deps.now ?? (() => new Date()),
      timeoutMs: deps.timeoutMs,
    },
  );
  if (res.status !== "ok") return { status: res.status, items: [], error: res.error };
  const own = input.domain ? bareDomain(input.domain) : null;
  const items = res.items
    .filter((i) => !own || !i.domain || bareDomain(i.domain) !== own)
    .slice(0, input.limit ?? MAX_SUGGESTED_COMPETITORS)
    .map((i) => ({
      name: i.title,
      cid: i.cid,
      ...(i.domain ? { domain: bareDomain(i.domain) } : {}),
      ...(i.rating !== undefined ? { rating: i.rating } : {}),
    }));
  return { status: "ok", items };
}
