import { formatAge } from "@/components/ui/Freshness";
import { formatPercent } from "@/components/ui/StatNumber";
import { ENGINES, ENGINE_LABEL, type WorkspaceView } from "@/lib/queries/workspace";
import type { Metric } from "@/types/metrics";

export const SECTIONS = [
  "dashboard",
  "questions",
  "competitors",
  "sources",
  "fixes",
  "experiments",
  "reports",
  "history",
  "settings",
] as const;
export type Section = (typeof SECTIONS)[number];
export const SECTION_LABEL: Record<Section, string> = {
  dashboard: "Dashboard",
  questions: "Questions",
  competitors: "Competitors",
  sources: "Sources",
  fixes: "Fix list",
  experiments: "Experiments",
  reports: "Reports",
  history: "History",
  settings: "Settings",
};
// docs/COPY.md 4b empty states. The seed has no fixes, experiments or reports.
export const EMPTY: Partial<Record<Section, string>> = {
  fixes: "Nothing to fix yet. Run your first check.",
  experiments: "Changed a page? Test it against questions you didn't change.",
  reports: "Your first report sends on the 1st.",
};

export type Selection =
  | { kind: "section"; section: Section }
  | { kind: "question"; id: string }
  | { kind: "competitor"; name: string }
  | { kind: "domain"; domain: string }
  | { kind: "check"; runId: string };

export type Fact = { label: string; text: string; note?: string };
export type Context = {
  title: string;
  business: string;
  place: string;
  checkedAt: string | null;
  answers: number;
  facts: Fact[];
  empty?: string;
  links?: { title: string; url: string }[];
};

export const namedText = (m: Metric) => `named in ${m.numerator} of ${m.denominator} answers`;
export const visibilityText = (m: Metric) => `${formatPercent(m)} (${namedText(m)})`;
export const linksText = (n: number) => `${n} ${n === 1 ? "link" : "links"}`;
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const pct = (m: Metric) => Math.floor((m.numerator * 100) / m.denominator);
export function pointsChange(now: Metric, before: Metric | undefined): string | null {
  if (!before || !now.denominator || !before.denominator) return null;
  const d = pct(now) - pct(before);
  return `${d > 0 ? "+" : ""}${d} pts`;
}
export const fallbackNote = (engine: string) =>
  `${engine} can't target a city yet, so we check it for the whole country.`;

export function contextFor(view: WorkspaceView, s: Selection): Context {
  const { business, latest, checks } = view;
  const base = {
    business: business.name,
    place: [business.city, business.state].filter(Boolean).join(", "),
    checkedAt: latest.checkedAt,
    answers: latest.answers,
  };
  const engineFacts = (by: Record<string, Metric>) =>
    ENGINES.map((e) => ({ label: ENGINE_LABEL[e], text: namedText(by[e]) }));
  const visibility = (m: Metric, before?: Metric): Fact[] => {
    const change = pointsChange(m, before);
    return [{ label: "Visibility", text: visibilityText(m) }, ...(change ? [{ label: "Change", text: change }] : [])];
  };

  if (s.kind === "question") {
    const q = view.questions.find((x) => x.id === s.id)!;
    const fallback = ENGINES.filter((e) => q.answers.some((a) => a.engine === e && a.fallbackCountry));
    return {
      ...base,
      title: q.text,
      facts: [
        ...visibility(q.visibility),
        ...ENGINES.map((e) => ({
          label: ENGINE_LABEL[e],
          text: namedText(q.byEngine[e]),
          note: fallback.includes(e) ? fallbackNote(ENGINE_LABEL[e]) : undefined,
        })),
      ],
      links: q.answers.flatMap((a) => a.citations.map((c) => ({ title: c.title ?? c.domain, url: c.url }))),
    };
  }
  if (s.kind === "competitor") {
    const c = view.competitors.find((x) => x.name === s.name)!;
    const you = view.competitors.find((x) => x.you)!;
    return {
      ...base,
      title: c.name,
      facts: [
        { label: "Named", text: visibilityText(c.named) },
        ...(c.you ? [] : [{ label: you.name, text: visibilityText(you.named) }]),
      ],
    };
  }
  if (s.kind === "domain") {
    const d = view.sources.domains.find((x) => x.domain === s.domain)!;
    return { ...base, title: d.domain, facts: [{ label: "Sources", text: linksText(d.links) }] };
  }
  if (s.kind === "check") {
    const i = checks.findIndex((c) => c.runId === s.runId);
    const c = checks[i];
    return {
      ...base,
      title: formatDate(c.finishedAt),
      checkedAt: c.finishedAt,
      answers: c.ok,
      facts: visibility(c.visibility, checks[i + 1]?.visibility),
    };
  }

  const title = SECTION_LABEL[s.section];
  switch (s.section) {
    case "dashboard":
    case "questions":
      return {
        ...base,
        title,
        facts: [...visibility(latest.visibility, checks[1]?.visibility), ...engineFacts(latest.byEngine)],
      };
    case "competitors":
      return { ...base, title, facts: view.competitors.map((c) => ({ label: c.name, text: visibilityText(c.named) })) };
    case "sources":
      return {
        ...base,
        title,
        facts: [
          { label: "Sources", text: linksText(view.sources.links) },
          ...ENGINES.map((e) => ({ label: ENGINE_LABEL[e], text: linksText(view.sources.byEngine[e]) })),
        ],
      };
    case "history":
      return {
        ...base,
        title,
        facts: checks.map((c, i) => ({
          label: formatDate(c.finishedAt),
          text: [visibilityText(c.visibility), pointsChange(c.visibility, checks[i + 1]?.visibility)]
            .filter(Boolean)
            .join(", "),
        })),
      };
    case "settings":
      return {
        ...base,
        title,
        facts: [
          { label: "Business", text: `${business.name}, ${base.place}` },
          { label: "Questions", text: String(view.questions.length) },
          { label: "Competitors", text: String(view.competitors.length - 1) },
        ],
      };
    default:
      return { ...base, title, facts: [], empty: EMPTY[s.section] };
  }
}

// Markdown brief of stored facts only, for Copy context and Open in Claude.
export function buildBrief(ctx: Context, now: Date, prompt = ""): string {
  const lines = [`# ${ctx.title}`, "", `${ctx.business} · ${ctx.place} · Example data`];
  if (ctx.checkedAt)
    lines.push(
      `Checked ${formatAge(new Date(ctx.checkedAt), now)} ago · ${ctx.answers} answers · API-measured, directional`,
    );
  else lines.push("API-measured, directional");
  lines.push("");
  if (ctx.empty) lines.push(ctx.empty, "");
  for (const f of ctx.facts) {
    lines.push(`- ${f.label}: ${f.text}`);
    if (f.note) lines.push(`  ${f.note}`);
  }
  if (ctx.facts.length) lines.push("");
  if (ctx.links?.length) {
    lines.push("## Sources", "");
    for (const l of ctx.links) lines.push(`- ${l.title}: ${l.url}`);
    lines.push("");
  }
  const p = prompt.trim();
  if (p) lines.push("## Prompt template", "", p, "");
  return lines.join("\n");
}

// claude.ai has no documented prefill; ?q= is the known form. Long briefs go by clipboard only.
export const CLAUDE_Q_MAX = 6000;
export function claudeUrl(brief: string): string {
  const q = encodeURIComponent(brief);
  return q.length > CLAUDE_Q_MAX ? "https://claude.ai/new" : `https://claude.ai/new?q=${q}`;
}
