// Bar mark (same geometry as public/logo-mark.svg) left of the "Rank1" wordmark.
export function Logo({ wordmarkClassName = "" }: { wordmarkClassName?: string } = {}) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <svg viewBox="0 0 64 48" width={21} height={16} fill="currentColor" aria-hidden="true">
        <path d="M0 48V21a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v27z" />
        <path d="M22 48V3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v45z" />
        <path d="M44 48V31a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v17z" />
      </svg>
      <span className={`font-display text-wordmark font-semibold ${wordmarkClassName}`}>Rank1</span>
    </span>
  );
}
