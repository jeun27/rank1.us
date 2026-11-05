import type { Metric } from "@/types/metrics";

// Whole percent, rounded down so a stat is never shown higher than measured.
export function formatPercent({ numerator, denominator }: Metric): string {
  return denominator > 0 ? `${Math.floor((numerator * 100) / denominator)}%` : "–";
}

export function StatNumber({ metric }: { metric: Metric }) {
  return (
    <div>
      <p className="font-display text-hero font-semibold tabular-nums">{formatPercent(metric)}</p>
      <p className="text-caption text-inkMuted tabular-nums">{`named in ${metric.numerator} of ${metric.denominator} answers`}</p>
    </div>
  );
}
