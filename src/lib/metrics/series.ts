import type { Metric } from "@/types/metrics";

// The fields of backend's RunSummary (src/lib/queries/shell.ts listRunSummaries) the line needs.
export type SeriesSummary = {
  id: string;
  kind: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  visibility: Metric;
};

export type SeriesPoint = { runId: string; at: string; metric: Metric };

export const SERIES_RUNS = 8;

// The Dashboard line: the latest 8 complete/partial audit or weekly runs, oldest → newest.
// Hidden (visible false) with fewer than 2 points. listRunSummaries returns every status, so pass it a
// limit above 8 (e.g. 20) to get 8 points when some recent runs failed.
export function seriesFromSummaries(summaries: SeriesSummary[]): { points: SeriesPoint[]; visible: boolean } {
  const points = summaries
    .filter((s) => (s.kind === "audit" || s.kind === "weekly") && (s.status === "complete" || s.status === "partial"))
    .filter((s) => s.finished_at ?? s.started_at)
    .sort((a, b) => (b.finished_at ?? b.started_at)!.localeCompare((a.finished_at ?? a.started_at)!))
    .slice(0, SERIES_RUNS)
    .reverse()
    .map((s) => ({
      runId: s.id,
      at: (s.finished_at ?? s.started_at)!,
      metric: s.visibility,
    }));
  return { points, visible: points.length >= 2 };
}
