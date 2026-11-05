import { normalize } from "@/lib/runs/mentions";
import { bareDomain, MAX_SUGGESTED_COMPETITORS } from "./competitors";
import type { LookupStore } from "./limits";
import { lookupCompetitors, type CompetitorLookup } from "./lookup";
import type { LocalCompetitor } from "./types";
import type { findLocalCompetitors } from "./competitors";

export type KnownCompetitor = { name: string; domain?: string | null };

export type SuggestInput = {
  business: CompetitorLookup & { name?: string };
  tracked: KnownCompetitor[];
  dismissed: KnownCompetitor[];
};

export type Suggestions = { status: "ok" | "limited" | "missing_keys" | "error"; items: LocalCompetitor[] };

const nameKey = (n: string) => normalize(n);
const domainKey = (d?: string | null) => (d ? bareDomain(d) : null);

// Maps results for the business, minus tracked, dismissed and the business itself (by domain or
// normalized name), first of each kept, in Maps order, up to 5. Never throws; failures are an empty list.
export async function suggestCompetitors(
  { business, tracked, dismissed }: SuggestInput,
  deps: { store: LookupStore; find?: typeof findLocalCompetitors },
): Promise<Suggestions> {
  let found;
  try {
    found = await lookupCompetitors(deps.store, business, deps.find);
  } catch {
    return { status: "error", items: [] };
  }
  if (found === "limited") return { status: "limited", items: [] };
  if (found.status !== "ok") return { status: found.status, items: [] };

  const known = [...tracked, ...dismissed, { name: business.name ?? "", domain: business.domain }];
  const names = new Set(known.map((k) => nameKey(k.name)).filter(Boolean));
  const domains = new Set(known.map((k) => domainKey(k.domain)).filter(Boolean));
  const items: LocalCompetitor[] = [];
  for (const c of found.items) {
    const n = nameKey(c.name);
    const d = domainKey(c.domain);
    if (!n || names.has(n) || (d && domains.has(d))) continue;
    names.add(n);
    if (d) domains.add(d);
    items.push(c);
    if (items.length === MAX_SUGGESTED_COMPETITORS) break;
  }
  return { status: "ok", items };
}
