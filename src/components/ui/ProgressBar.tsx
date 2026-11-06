import { floorPct, metric } from "@/lib/metrics/compute";

// Floored like formatPercent, so progress is never shown higher than measured. null when there is no total.
export function progressPercent(done: number, total: number): number | null {
  const pct = floorPct(metric(done, total));
  return pct === null ? null : Math.min(100, Math.max(0, pct));
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = progressPercent(done, total);
  const label = `${done.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} answers`;
  return (
    <div className="w-full max-w-75">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 overflow-hidden rounded-full bg-overlay"
      >
        {/* v3 (UI.md Loading + progress): a 6px overlay track, the accent fill sized by scaleX. */}
        <div
          className="h-full w-full origin-left rounded-full bg-accent"
          style={{ transform: `scaleX(${(pct ?? 0) / 100})` }}
        />
      </div>
      <p className="mt-2 flex justify-between gap-4 text-caption tabular-nums">
        <span className="font-mono text-inkMuted">{label}</span>
        {pct !== null && <span className="font-mono font-medium text-jellyDeep">{pct}%</span>}
      </p>
    </div>
  );
}
