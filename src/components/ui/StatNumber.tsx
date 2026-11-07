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

// A table cell (DQ4): the % in mono with its n as a caption, stacked below md so neither wraps mid-phrase.
export function VisibilityCell({ metric }: { metric: Metric }) {
  return (
    <span data-computed className="inline-flex flex-col items-end md:flex-row md:items-baseline md:gap-2">
      <span className="font-mono font-medium tracking-[-0.03em]">{formatPercent(metric)}</span>{" "}
      <span className="text-caption text-inkMuted">{`named in ${metric.numerator} of ${metric.denominator} answers`}</span>
    </span>
  );
}
