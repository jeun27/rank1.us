import "server-only";
import { mapsSearch } from "@/lib/engines/maps";
import type { EngineDeps } from "@/lib/engines/types";
import type { FindLocalCompetitorsInput, LocalCompetitorsResult } from "./types";

// The Maps keyword for a business type: "{cuisine} restaurant", a local service's category, or null
// (software, shops, or no category) when there's nothing local to search.
export function mapsTerm(q: Pick<FindLocalCompetitorsInput, "vertical" | "category"> & { cuisine: string | null }) {
  if (!q.vertical || q.vertical === "restaurant") return `${(q.cuisine ?? "").trim()} restaurant`.trim();
  if (q.vertical === "saas" || q.vertical === "dtc") return null;
  return q.category?.trim().toLowerCase() || null;
}

export const MAX_SUGGESTED_COMPETITORS = 5;

export const bareDomain = (d: string) =>
  d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^www\./, "");

// Top 5 Maps results for the business type's term, in Google Maps order (no re-ranking), the business
// itself excluded. No term = no request.
export async function findLocalCompetitors(
  input: FindLocalCompetitorsInput,
  deps: Partial<EngineDeps> = {},
): Promise<LocalCompetitorsResult> {
  const keyword = mapsTerm(input);
  if (!keyword) return { status: "ok", items: [] };
  const res = await mapsSearch(
    { keyword, city: input.city, state: input.state },
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
