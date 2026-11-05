import { ENGINE_IDS, type EngineId } from "@/lib/engines/types";
import type { Category } from "@/lib/runs/categorize";
import type { BrandMention } from "@/lib/runs/types";
import type { Metric } from "@/types/metrics";

// The answer and citation fields metrics need (no raw, no cost), as the result queries return them.
export type MetricAnswer = {
  id: string;
  question_id: string | null;
  question_text_used: string;
  engine: EngineId;
  run_index: number;
  status: "ok" | "failed" | "no_overview";
  mentioned: boolean | null;
  first_position: number | null;
  brands: BrandMention[] | null;
  location_used: string | null;
  location_supported: "exact" | "fallback_country" | null;
  checked_at: string;
};

export type MetricCitation = {
  answer_id: string;
  url: string;
  domain: string;
  position: number;
  category: Category | null;
};

export type MetricBrand = { name: string; kind: BrandMention["kind"] };

export type LeaderboardRow = {
  name: string;
  kind: MetricBrand["kind"];
  metric: Metric;
  change: number | null;
  tooFew: boolean;
};

export type Metrics = {
  visibility: Metric & { byEngine: Record<EngineId, Metric> };
  leaderboard: LeaderboardRow[];
  shareOfVoice: Metric;
  sources: { domain: string; category: Category; count: number }[];
  jobs: { ok: number; failed: number };
  freshness: string | null;
};

export type MetricsInput = {
  answers: MetricAnswer[];
  citations: MetricCitation[];
  brands: MetricBrand[];
  // Free audits have no questions table rows, so every answer counts; paid runs skip deleted questions.
  freeAudit?: boolean;
  previous?: { answers: MetricAnswer[]; freeAudit?: boolean };
};

export const TOO_FEW = 10;

export const metric = (numerator: number, denominator: number): Metric => ({
  value: denominator ? numerator / denominator : null,
  numerator,
  denominator,
});

// Whole percent, rounded down so a stat is never shown higher than measured.
export const floorPct = (m: Metric) => (m.value === null ? null : Math.floor(m.value * 100));

// Successful answers only: failed and no_overview leave every denominator; so do deleted questions on paid runs.
export const counted = (answers: MetricAnswer[], freeAudit = false) =>
  answers.filter((a) => a.status === "ok" && (freeAudit || a.question_id !== null));

const named = (a: MetricAnswer, name: string) => !!a.brands?.some((b) => b.name === name && b.mentioned);

function brandMetric(answers: MetricAnswer[], b: MetricBrand): Metric {
  const hits = answers.filter((a) => (b.kind === "business" ? a.mentioned === true : named(a, b.name))).length;
  return metric(hits, answers.length);
}

export function computeMetrics({ answers, citations, brands, freeAudit = false, previous }: MetricsInput): Metrics {
  const ok = counted(answers, freeAudit);
  const business = brands.find((b) => b.kind === "business");
  const vis = business ? brandMetric(ok, business) : metric(0, ok.length);
  const byEngine = Object.fromEntries(
    ENGINE_IDS.map((e) => {
      const on = ok.filter((a) => a.engine === e);
      return [e, business ? brandMetric(on, business) : metric(0, on.length)];
    }),
  ) as Record<EngineId, Metric>;

  const prev = previous ? counted(previous.answers, previous.freeAudit) : null;
  const leaderboard = brands
    .map((b) => {
      const m = brandMetric(ok, b);
      const p = prev ? brandMetric(prev, b) : null;
      const now = floorPct(m);
      const before = p ? floorPct(p) : null;
      return {
        name: b.name,
        kind: b.kind,
        metric: m,
        change: now !== null && before !== null ? now - before : null,
        tooFew: m.denominator < TOO_FEW,
      };
    })
    .sort(
      (a, b) =>
        (b.metric.value ?? -1) - (a.metric.value ?? -1) ||
        b.metric.numerator - a.metric.numerator ||
        (a.kind === "business" ? -1 : b.kind === "business" ? 1 : 0) ||
        a.name.localeCompare(b.name),
    );

  // Each tracked brand counts once per answer it's named in.
  const mentions = ok.reduce(
    (n, a) => n + new Set((a.brands ?? []).filter((b) => b.mentioned).map((b) => b.name)).size,
    0,
  );
  const shareOfVoice = metric(vis.numerator, mentions);

  const okIds = new Set(ok.map((a) => a.id));
  const byDomain = new Map<string, { domain: string; category: Category; count: number }>();
  for (const c of citations) {
    if (!okIds.has(c.answer_id)) continue;
    const d = c.domain.toLowerCase();
    const row = byDomain.get(d) ?? { domain: d, category: c.category ?? "other", count: 0 };
    row.count++;
    byDomain.set(d, row);
  }
  const sources = [...byDomain.values()].sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));

  const freshness = answers.reduce<string | null>((max, a) => (!max || a.checked_at > max ? a.checked_at : max), null);
  const failed = answers.filter((a) => a.status === "failed").length;
  return {
    visibility: { ...vis, byEngine },
    leaderboard,
    shareOfVoice,
    sources,
    jobs: { ok: answers.length - failed, failed },
    freshness,
  };
}
