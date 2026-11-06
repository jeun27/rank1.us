import { formatAge } from "@/components/ui/Freshness";
import { formatPercent } from "@/components/ui/StatNumber";
import { sourcesCopy } from "@/components/app/sources-copy";
import type { Metrics, Sources } from "@/lib/metrics";
import { floorPct } from "@/lib/metrics/compute";
import { ENGINES, ENGINE_LABEL, type Engine, type WorkspaceView } from "@/lib/queries/workspace";
import type { Metric } from "@/types/metrics";
import { signedPts } from "@/lib/metrics/delta";

// The /app rail order (X16), so /team reads the same.
export const SECTIONS = [
  "dashboard",
  "competitors",
  "questions",
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
  fixes: "What to fix next",
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
const pct = (m: Metric) => floorPct(m)!;
// The change in floored points (null when either side has no answers), and its one display form.
export function pointsDelta(now: Metric, before: Metric | undefined): number | null {
  if (!before || !now.denominator || !before.denominator) return null;
  return pct(now) - pct(before);
}
export function pointsChange(now: Metric, before: Metric | undefined): string | null {
  const d = pointsDelta(now, before);
  return d === null ? null : signedPts(d);
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

// Open in Claude opens exactly this (Step 11): no ?q= prefill and no data in the URL. The brief goes by
// clipboard only (ContextPane copies it first).
export const CLAUDE_URL = "https://claude.ai";

// ---- Real-data brief (Step 11) ----------------------------------------------------------------------

export type ContextInput = {
  business: { name: string; city: string | null; state: string | null };
  // computeMetrics over the latest complete/partial run (with the previous run), or null before a run.
  metrics: Metrics | null;
  sources: Sources | null;
  fixes: {
    ranked: { title: string; detail: string | null }[];
    tidyUps: { title: string; detail: string | null }[];
  } | null;
  questions: {
    id: string;
    text: string;
    answers: {
      engine: Engine;
      status: "ok" | "failed" | "no_overview";
      mentioned: boolean | null;
      location_supported: "exact" | "fallback_country" | null;
      citations: { url: string; domain: string; title: string | null }[];
    }[];
  }[];
  // listRunSummaries rows, newest first.
  checks: { id: string; status: string; started_at: string | null; finished_at: string | null; visibility: Metric }[];
};

export type ContextSelection = Selection;

export const LIST_MAX = 10;
export const QUESTIONS_MAX = 25;
export const BRIEF_MAX = 12_000;
const LABEL = "API-measured, directional";
const CATEGORY = sourcesCopy.categories as Record<string, string>;

const share = (m: Metric) => (m.denominator ? visibilityText(m) : "no answers yet");
const capped = <T>(items: T[], max: number, line: (x: T) => string) => [
  ...items.slice(0, max).map(line),
  ...(items.length > max ? [`- …and ${items.length - max} more`] : []),
];

// A stored-data brief for Copy context: only named fields of query/metrics output are read (never raw,
// cost, why_note, evidence, emails or tokens), every % carries its n, and the header carries freshness
// and the label. Output depends only on the input, the selection and `now`.
export function buildContextMarkdown(input: ContextInput, sel: ContextSelection, now: Date, prompt = ""): string {
  const { business, metrics, sources } = input;
  const place = [business.city, business.state].filter(Boolean).join(", ");
  const at = (iso: string | null, n: number) =>
    iso ? `Checked ${formatAge(new Date(iso), now)} ago · ${n} answers · ${LABEL}` : LABEL;

  const prev = input.checks.find((c, i) => i > 0 && (c.status === "complete" || c.status === "partial"));
  const visibility = (): string[] => {
    if (!metrics) return ["- Visibility: no answers yet"];
    const change = pointsChange(metrics.visibility, prev?.visibility);
    const fallback = new Set(sources?.engines.filter((e) => e.locationSupport === "fallback").map((e) => e.engine));
    return [
      `- Visibility: ${share(metrics.visibility)}`,
      ...(change ? [`- Change: ${change}`] : []),
      ...ENGINES.flatMap((e) => [
        `- ${ENGINE_LABEL[e]}: ${share(metrics.visibility.byEngine[e])}`,
        ...(fallback.has(e) ? [`  ${fallbackNote(ENGINE_LABEL[e])}`] : []),
      ]),
    ];
  };
  const leader = (r: Metrics["leaderboard"][number]) =>
    `- ${r.name}${r.kind === "business" ? " (you)" : ""}: ${share(r.metric)}${r.change !== null ? `, ${signedPts(r.change)}` : ""}${r.tooFew ? ", too few answers" : ""}`;
  const domainLine = (d: Sources["topDomains"][number]) =>
    `- ${d.domain} (${CATEGORY[d.category] ?? CATEGORY.other}): ${linksText(d.links)} · ${d.engines.map((e) => ENGINE_LABEL[e]).join(", ")}`;
  const fixLine = (f: { title: string; detail: string | null }) => `- ${f.title}${f.detail ? `: ${f.detail}` : ""}`;
  const notNamed = input.questions
    .map((q) => ({ q, ok: q.answers.filter((a) => a.status === "ok") }))
    .filter(({ ok }) => ok.length > 0 && ok.every((a) => a.mentioned !== true));

  const sections: { title: string; lines: string[]; keep?: boolean }[] = [];
  let title = business.name;
  let header = at(metrics?.freshness ?? null, metrics?.visibility.denominator ?? 0);
  const links: { title: string; url: string }[] = [];

  if (sel.kind === "question") {
    const q = input.questions.find((x) => x.id === sel.id);
    title = q?.text ?? business.name;
    const ok = q?.answers.filter((a) => a.status === "ok") ?? [];
    sections.push({
      title: "Visibility",
      keep: true,
      lines: [
        `- Visibility: ${share({ value: null, numerator: ok.filter((a) => a.mentioned).length, denominator: ok.length })}`,
        ...ENGINES.flatMap((e) => {
          const on = ok.filter((a) => a.engine === e);
          const fb = q?.answers.some((a) => a.engine === e && a.location_supported === "fallback_country");
          return [
            `- ${ENGINE_LABEL[e]}: ${share({ value: null, numerator: on.filter((a) => a.mentioned).length, denominator: on.length })}`,
            ...(fb ? [`  ${fallbackNote(ENGINE_LABEL[e])}`] : []),
          ];
        }),
      ],
    });
    for (const a of ok) for (const c of a.citations) links.push({ title: c.title ?? c.domain, url: c.url });
  } else if (sel.kind === "competitor") {
    const rows = metrics?.leaderboard ?? [];
    const row = rows.find((r) => r.name === sel.name);
    const you = rows.find((r) => r.kind === "business");
    title = sel.name;
    sections.push({
      title: "Leaderboard",
      keep: true,
      lines: [row, ...(row?.kind === "business" ? [] : [you])].filter((r) => !!r).map((r) => leader(r!)),
    });
  } else if (sel.kind === "domain") {
    const d = sources?.topDomains.find((x) => x.domain === sel.domain);
    title = sel.domain;
    sections.push({ title: "Top sources", keep: true, lines: d ? [domainLine(d)] : ["- No cited links yet"] });
  } else if (sel.kind === "check") {
    const c = input.checks.find((x) => x.id === sel.runId);
    const i = c ? input.checks.indexOf(c) : -1;
    title = c?.finished_at ? formatDate(c.finished_at) : business.name;
    header = at(c?.finished_at ?? null, c?.visibility.denominator ?? 0);
    const change = c ? pointsChange(c.visibility, input.checks[i + 1]?.visibility) : null;
    sections.push({
      title: "Visibility",
      keep: true,
      lines: c
        ? [`- Visibility: ${share(c.visibility)}`, ...(change ? [`- Change: ${change}`] : [])]
        : ["- Visibility: no answers yet"],
    });
  } else {
    const s = sel.section;
    const all = s === "dashboard";
    if (all || s === "questions") sections.push({ title: "Visibility", keep: true, lines: visibility() });
    if (all || s === "competitors")
      sections.push({ title: "Leaderboard", lines: capped(metrics?.leaderboard ?? [], LIST_MAX, leader) });
    if (all || s === "sources")
      sections.push({ title: "Top sources", lines: capped(sources?.topDomains ?? [], LIST_MAX, domainLine) });
    if (all || s === "fixes") {
      const open = [...(input.fixes?.ranked ?? []), ...(input.fixes?.tidyUps ?? [])];
      sections.push({
        title: "Open fixes",
        lines: open.length ? capped(open, LIST_MAX, fixLine) : [`- ${EMPTY.fixes}`],
      });
    }
    if (all || s === "questions")
      sections.push({
        title: `Questions where ${business.name} wasn't named`,
        lines: capped(notNamed, QUESTIONS_MAX, ({ q, ok }) => `- ${q.text} (named in 0 of ${ok.length} answers)`),
      });
    if (s === "history")
      sections.push({
        title: "History",
        lines: capped(input.checks, LIST_MAX, (c) => {
          const i = input.checks.indexOf(c);
          const change = pointsChange(c.visibility, input.checks[i + 1]?.visibility);
          return `- ${c.finished_at ? formatDate(c.finished_at) : c.status}: ${share(c.visibility)}${change ? `, ${change}` : ""}`;
        }),
      });
    if (s !== "dashboard") title = SECTION_LABEL[s];
  }

  const render = (secs: typeof sections) => {
    const out = [`# ${title}`, "", [business.name, place].filter(Boolean).join(" · "), header, ""];
    for (const sec of secs) if (sec.lines.length) out.push(`## ${sec.title}`, "", ...sec.lines, "");
    if (links.length) out.push("## Sources", "", ...capped(links, LIST_MAX, (l) => `- ${l.title}: ${l.url}`), "");
    const p = prompt.trim();
    if (p) out.push("## Prompt template", "", p, "");
    return out.join("\n");
  };
  // Over the cap, drop the lowest sections first; the header and kept (visibility) sections stay.
  let secs = sections;
  let md = render(secs);
  while (md.length > BRIEF_MAX) {
    const drop = secs
      .map((x, i) => (x.keep ? -1 : i))
      .filter((i) => i >= 0)
      .pop();
    if (drop === undefined) break;
    secs = secs.filter((_, i) => i !== drop);
    md = render(secs);
  }
  return md.length > BRIEF_MAX ? md.slice(0, BRIEF_MAX) : md;
}
