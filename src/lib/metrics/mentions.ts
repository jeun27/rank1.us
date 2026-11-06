import { sourcesCopy } from "@/components/app/sources-copy";
import type { EngineId } from "@/lib/engines/types";
import { normalizeUrl } from "@/lib/runs/citations";
import type { BrandMention } from "@/lib/runs/types";

// G7 "Lists that name your rivals but not you", on read from the latest run's stored results (no LLM):
// pages cited in counted answers that name ≥1 competitor and not the business. A business's own site and
// a competitor's own site aren't lists, so they're left out. Users' decisions split the pages.
export type MentionInput = {
  brands: { name: string; kind: "business" | "competitor"; domain: string | null }[];
  answers: {
    id: string;
    engine: EngineId;
    status: string;
    question_id: string | null;
    mentioned: boolean | null;
    brands: BrandMention[] | null;
  }[];
  citations: { answer_id: string; url: string; domain: string; title: string | null; category: string | null }[];
};
export type MentionDecision = { url: string; status: "added" | "dismissed"; decided_at: string };

export type MentionTarget = {
  url: string;
  domain: string;
  title: string | null;
  category: string;
  rivals: string[]; // most-named first
  answers: number; // k of n
  engines: EngineId[];
};
export type MentionTargets = {
  n: number;
  candidates: MentionTarget[];
  added: MentionTarget[];
  dismissed: MentionTarget[];
};

const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");
const onSite = (domain: string, site: string) => domain === site || domain.endsWith(`.${site}`);
const label = (c: string | null) =>
  (sourcesCopy.categories as Record<string, string>)[c ?? ""] ?? sourcesCopy.categories.other;

export function mentionTargets(input: MentionInput, decisions: MentionDecision[]): MentionTargets {
  const order = input.brands.filter((b) => b.kind === "competitor").map((b) => b.name);
  const ownSites = input.brands.flatMap((b) => (b.domain ? [bare(b.domain)] : []));
  // Counted answers (ok, question still exists) that name a rival and not the business.
  const gaps = new Map<string, { engine: EngineId; rivals: string[] }>();
  for (const a of input.answers) {
    if (a.status !== "ok" || a.question_id === null) continue;
    const named = (a.brands ?? []).filter((m) => m.mentioned);
    const rivals = named.filter((m) => m.kind === "competitor").map((m) => m.name);
    if (a.mentioned || named.some((m) => m.kind === "business") || !rivals.length) continue;
    gaps.set(a.id, { engine: a.engine, rivals });
  }
  const pages = new Map<
    string,
    {
      t: Omit<MentionTarget, "rivals" | "answers" | "engines">;
      rivals: Map<string, number>;
      seen: Set<string>;
      engines: Set<EngineId>;
    }
  >();
  for (const c of input.citations) {
    const gap = gaps.get(c.answer_id);
    const domain = bare(c.domain);
    if (!gap || ownSites.some((s) => onSite(domain, s))) continue;
    const url = normalizeUrl(c.url);
    const p = pages.get(url) ?? {
      t: { url, domain, title: c.title, category: label(c.category) },
      rivals: new Map(),
      seen: new Set(),
      engines: new Set(),
    };
    if (!p.t.title && c.title) p.t.title = c.title;
    if (!p.seen.has(c.answer_id)) {
      p.seen.add(c.answer_id);
      p.engines.add(gap.engine);
      for (const r of gap.rivals) p.rivals.set(r, (p.rivals.get(r) ?? 0) + 1);
    }
    pages.set(url, p);
  }
  const byName = (m: Map<string, number>) =>
    [...m.keys()].sort((a, b) => m.get(b)! - m.get(a)! || order.indexOf(a) - order.indexOf(b));
  const targets: MentionTarget[] = [...pages.values()]
    .map((p) => ({ ...p.t, rivals: byName(p.rivals), answers: p.seen.size, engines: [...p.engines].sort() }))
    .sort((a, b) => b.answers - a.answers || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const decided = new Map(decisions.map((d) => [normalizeUrl(d.url), d.status]));
  return {
    n: gaps.size,
    candidates: targets.filter((t) => !decided.has(t.url)),
    added: targets.filter((t) => decided.get(t.url) === "added"),
    dismissed: targets.filter((t) => decided.get(t.url) === "dismissed"),
  };
}

// R17 "{n} lists AI cites name {rivals} but not you.": n = the added lists; rivals = up to 3 names, those on
// the most added lists first (ties alphabetical). Null when nothing is added (no R17 fix).
export function r17Fill(added: MentionTarget[]): { n: string; rivals: string } | null {
  if (!added.length) return null;
  const lists = new Map<string, number>();
  for (const t of added) for (const r of t.rivals) lists.set(r, (lists.get(r) ?? 0) + 1);
  const names = [...lists.keys()].sort((a, b) => lists.get(b)! - lists.get(a)! || a.localeCompare(b)).slice(0, 3);
  const rivals = names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return { n: String(added.length), rivals };
}
