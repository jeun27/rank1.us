import type { EngineCitation } from "@/lib/engines/types";
import { categorize, hostOf, type Category } from "./categorize";
import type { FinishCitation } from "./types";

export type StoredCitation = FinishCitation & { category: Category };

// Same link = same lowercase scheme and host, no trailing slash, no utm_* params, no #fragment
// (AIO references carry #:~:text= anchors).
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return url.trim();
  }
}

// One row per normalized URL (first occurrence kept), positions renumbered 1..n in engine order.
export function toStoredCitations(cits: EngineCitation[], overrides: Record<string, Category> = {}): StoredCitation[] {
  const seen = new Set<string>();
  const out: StoredCitation[] = [];
  for (const c of [...cits].sort((a, b) => a.position - b.position)) {
    const key = normalizeUrl(c.url);
    if (seen.has(key)) continue;
    seen.add(key);
    const domain = (c.domain || hostOf(c.url).host).toLowerCase();
    out.push({
      url: c.url,
      domain,
      title: c.title ?? null,
      position: out.length + 1,
      category: categorize(c.url, overrides),
    });
  }
  return out;
}

export const citationDomains = (cits: EngineCitation[]) => [...new Set(cits.map((c) => hostOf(c.url).host))];
