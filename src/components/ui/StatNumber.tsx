import { floorPct } from "@/lib/metrics/compute";
import type { Metric } from "@/types/metrics";

// Whole percent, rounded down so a stat is never shown higher than measured.
export function formatPercent(m: Metric): string {
  const pct = floorPct(m);
  return pct === null ? "–" : `${pct}%`;
}

export function StatNumber({ metric }: { metric: Metric }) {
  return (
    <div>
      <p className="font-display text-hero font-semibold tabular-nums">{formatPercent(metric)}</p>
      <p className="text-caption text-inkMuted tabular-nums">{`named in ${metric.numerator} of ${metric.denominator} answers`}</p>
    </div>
  );
}
