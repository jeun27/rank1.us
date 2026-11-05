import type { Metric } from "@/types/metrics";
import { metric } from "./compute";

// A run summary as listRunSummaries returns it (newest first): overall visibility counts.
export type SeriesSummary = {
  id: string;
  kind: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  visibility: { named: number; n: number };
};

export type SeriesPoint = { runId: string; at: string; metric: Metric };

export const SERIES_RUNS = 8;

// The Dashboard line: the latest 8 complete/partial audit or weekly runs, oldest → newest.
// Hidden (visible false) with fewer than 2 points.
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
      metric: metric(s.visibility.named, s.visibility.n),
    }));
  return { points, visible: points.length >= 2 };
}
