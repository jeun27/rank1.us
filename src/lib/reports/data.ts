import { formatPercent } from "@/components/ui/StatNumber";
import { sourcesCopy } from "@/components/app/sources-copy";
import { ENGINE_IDS } from "@/lib/engines/types";
import { computeMetrics, type MetricAnswer, type MetricBrand, type MetricCitation } from "@/lib/metrics";
import { ENGINE_LABEL } from "@/lib/queries/workspace";
import { namedText, pointsChange } from "@/lib/workspace/context";
import type { Metric } from "@/types/metrics";
import { accentColor } from "./contrast";
import { monthLabel } from "./month";

export const LEADERBOARD_MAX = 5;
export const SOURCES_MAX = 10;
export const FIXES_MAX = 10;

export type ReportRun = {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  visibility: Metric;
};

export type ReportInput = {
  business: { name: string; brand_color: string | null };
  logo: { bytes: Uint8Array; type: "image/png" | "image/jpeg" } | null;
  periodStart: string; // "YYYY-MM-01"
  // The month's complete/partial runs (listRunSummaries), newest first.
  runs: ReportRun[];
  // getRunResults of the month's last run, or null when the month had none.
  last: { answers: MetricAnswer[]; citations: MetricCitation[]; brands: MetricBrand[] } | null;
  // The previous month's last run (for the change), or null.
  previous: ReportRun | null;
  fixes: { title: string; detail: string | null }[];
};

export type ReportData = {
  businessName: string;
  month: string;
  logo: ReportInput["logo"];
  accent: string;
  freshness: string | null;
  answers: number;
  visibility: { text: string; named: string; change: string | null } | null;
  engines: { label: string; text: string }[];
  competitors: { name: string; you: boolean; text: string }[];
  sources: { domain: string; category: string; links: number }[];
  fixes: { title: string; detail: string | null }[];
  weekly: { date: string; text: string; partial: boolean }[];
};

const pct = (m: Metric) => (m.denominator ? `${formatPercent(m)} (${namedText(m)})` : "no answers yet");
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// Stored numbers and texts only, picked by name (never raw, cost, why_note, evidence, emails or tokens).
export function buildReportData(input: ReportInput): ReportData {
  const m = input.last
    ? computeMetrics({ answers: input.last.answers, citations: input.last.citations, brands: input.last.brands })
    : null;
  const lastRun = input.runs[0] ?? null;
  return {
    businessName: input.business.name,
    month: monthLabel(input.periodStart),
    logo: input.logo,
    accent: accentColor(input.business.brand_color),
    freshness: m?.freshness ?? null,
    answers: m?.visibility.denominator ?? 0,
    visibility: m
      ? {
          text: pct(m.visibility),
          named: namedText(m.visibility),
          change: pointsChange(lastRun?.visibility ?? m.visibility, input.previous?.visibility),
        }
      : null,
    engines: m ? ENGINE_IDS.map((e) => ({ label: ENGINE_LABEL[e], text: pct(m.visibility.byEngine[e]) })) : [],
    competitors: (m?.leaderboard ?? [])
      .slice(0, LEADERBOARD_MAX)
      .map((r) => ({ name: r.name, you: r.kind === "business", text: pct(r.metric) })),
    sources: (m?.sources ?? []).slice(0, SOURCES_MAX).map((s) => ({
      domain: s.domain,
      category: (sourcesCopy.categories as Record<string, string>)[s.category] ?? sourcesCopy.categories.other,
      links: s.count,
    })),
    fixes: input.fixes.slice(0, FIXES_MAX).map((f) => ({ title: f.title, detail: f.detail })),
    weekly: [...input.runs].reverse().map((r) => ({
      date: day(r.finished_at ?? r.started_at ?? input.periodStart),
      text: pct(r.visibility),
      partial: r.status === "partial",
    })),
  };
}

const laDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(iso));

// From listRunSummaries (newest first): the runs started in [periodStart, periodEnd] (LA dates, inclusive)
// and the last run before the month, for the change.
export function monthRuns<R extends ReportRun>(
  summaries: R[],
  periodStart: string,
  periodEnd: string,
): { runs: R[]; previous: R | null } {
  const dated = summaries.flatMap((r) => {
    const at = r.started_at ?? r.finished_at;
    return at ? [{ r, day: laDay(at) }] : [];
  });
  return {
    runs: dated.filter((d) => d.day >= periodStart && d.day <= periodEnd).map((d) => d.r),
    previous: dated.find((d) => d.day < periodStart)?.r ?? null,
  };
}
