import { ENGINE_IDS, type EngineId } from "@/lib/engines/types";
import type { Category } from "@/lib/runs/categorize";

// The fields of getQuestionsWithLatestAnswers (src/lib/queries/shell.ts) the Sources page needs.
export type SourcesQuestion = {
  location_level: "country" | "state" | "city";
  country: string | null;
  state: string | null;
  city: string | null;
  answers: {
    engine: EngineId;
    status: "ok" | "failed" | "no_overview";
    location_supported: "exact" | "fallback_country" | null;
    citations: { url: string; domain: string; category?: string | null }[];
  }[];
};

export const CATEGORY_ORDER: readonly Category[] = [
  "reddit",
  "youtube",
  "social",
  "review_directory",
  "news_blog",
  "other",
];
export const TOP_DOMAINS = 20;

export type EngineSources = {
  engine: EngineId;
  links: number;
  byCategory: { category: Category; count: number }[];
  locationSupport: "exact" | "fallback" | null;
};
export type DomainRow = { domain: string; category: Category; links: number; engines: EngineId[] };
export type SourceLocation = { key: string; label: string; level: SourcesQuestion["location_level"] };
export type Sources = { engines: EngineSources[]; topDomains: DomainRow[]; locations: SourceLocation[] };

// The Questions page badge (#40) shows the level only: "Country", "State", "City" (COPY.md).
const LEVEL_LABEL = { country: "Country", state: "State", city: "City" } as const;
const LEVEL_ORDER = { city: 0, state: 1, country: 2 } as const;

const asCategory = (c: string | null | undefined): Category =>
  (CATEGORY_ORDER as readonly string[]).includes(c ?? "") ? (c as Category) : "other";
const bare = (d: string) =>
  d
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");

// A question's target: the level plus the place fields at or below it.
export function locationKey(q: Pick<SourcesQuestion, "location_level" | "country" | "state" | "city">): string {
  const state = q.location_level === "country" ? "" : (q.state ?? "");
  const city = q.location_level === "city" ? (q.city ?? "") : "";
  return `${q.location_level}:${q.country ?? ""}|${state}|${city}`;
}

const place = (q: SourcesQuestion) =>
  q.location_level === "city"
    ? [q.city, q.state].filter(Boolean).join(", ")
    : q.location_level === "state"
      ? (q.state ?? "")
      : (q.country ?? "");

export const locationLabel = (level: SourcesQuestion["location_level"]) => LEVEL_LABEL[level];

// Distinct targets of questions that have answers. Labels match the Questions badge; only when two
// targets share a level is the place added ("City · Irvine, CA") so the options stay distinct.
export function sourceLocations(questions: SourcesQuestion[]): SourceLocation[] {
  const seen = new Map<string, SourcesQuestion>();
  for (const q of questions) if (q.answers.length && !seen.has(locationKey(q))) seen.set(locationKey(q), q);
  const perLevel = new Map<string, number>();
  for (const q of seen.values()) perLevel.set(q.location_level, (perLevel.get(q.location_level) ?? 0) + 1);
  return [...seen.entries()]
    .map(([key, q]) => {
      const base = locationLabel(q.location_level);
      const label = (perLevel.get(q.location_level) ?? 0) > 1 && place(q) ? `${base} · ${place(q)}` : base;
      return { key, label, level: q.location_level };
    })
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.label.localeCompare(b.label));
}

// Per-engine cited links by category, top domains and the location options. Counts only (no %).
// Links = citations of ok answers, as stored (deduped per answer). Unknown location → empty.
export function computeSources({ questions, location }: { questions: SourcesQuestion[]; location?: string }): Sources {
  const inView = location === undefined ? questions : questions.filter((q) => locationKey(q) === location);
  const answers = inView.flatMap((q) => q.answers);

  const engines = ENGINE_IDS.map((engine): EngineSources => {
    const mine = answers.filter((a) => a.engine === engine);
    const counts = new Map<Category, number>(CATEGORY_ORDER.map((c) => [c, 0]));
    let links = 0;
    for (const a of mine) {
      if (a.status !== "ok") continue;
      for (const c of a.citations) {
        counts.set(asCategory(c.category), counts.get(asCategory(c.category))! + 1);
        links++;
      }
    }
    const ran = mine.filter((a) => a.status !== "failed" && a.location_supported);
    const locationSupport = !ran.length
      ? null
      : ran.some((a) => a.location_supported === "fallback_country")
        ? "fallback"
        : "exact";
    return {
      engine,
      links,
      byCategory: CATEGORY_ORDER.map((category) => ({ category, count: counts.get(category)! })),
      locationSupport,
    };
  });

  const byDomain = new Map<string, { links: number; engines: Set<EngineId>; cats: Map<Category, number> }>();
  for (const a of answers) {
    if (a.status !== "ok") continue;
    for (const c of a.citations) {
      const d = bare(c.domain);
      const row = byDomain.get(d) ?? { links: 0, engines: new Set<EngineId>(), cats: new Map<Category, number>() };
      row.links++;
      row.engines.add(a.engine);
      row.cats.set(asCategory(c.category), (row.cats.get(asCategory(c.category)) ?? 0) + 1);
      byDomain.set(d, row);
    }
  }
  const topDomains = [...byDomain.entries()]
    .map(([domain, r]) => ({
      domain,
      // The domain's most-cited category; ties go to the fixed category order.
      category: CATEGORY_ORDER.reduce(
        (best, c) => ((r.cats.get(c) ?? 0) > (r.cats.get(best) ?? 0) ? c : best),
        CATEGORY_ORDER[0],
      ),
      links: r.links,
      engines: ENGINE_IDS.filter((e) => r.engines.has(e)),
    }))
    .sort((a, b) => b.links - a.links || a.domain.localeCompare(b.domain))
    .slice(0, TOP_DOMAINS);

  return { engines, topDomains, locations: sourceLocations(questions) };
}
