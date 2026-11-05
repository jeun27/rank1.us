// Floored like formatPercent, so progress is never shown higher than measured. null when there is no total.
export function progressPercent(done: number, total: number): number | null {
  return total > 0 ? Math.min(100, Math.max(0, Math.floor((done / total) * 100))) : null;
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
        className="h-3 overflow-hidden rounded-full border border-border bg-white shadow-track"
      >
        <div className="h-full rounded-full bg-jellyDeep shadow-fill" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <p className="mt-2 flex justify-between gap-4 text-caption tabular-nums">
        <span className="text-inkMuted">{label}</span>
        {pct !== null && <span className="font-semibold text-jellyDeep">{pct}%</span>}
      </p>
    </div>
  );
}
