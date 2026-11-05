import type { ReactNode } from "react";

// Inline icons with paths from Lucide (ISC license), so there is no icon library dependency.
const paths = {
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden
      data-icon={name}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["shrink-0", className].filter(Boolean).join(" ")}
    >
      {paths[name]}
    </svg>
  );
}

// 16px three-quarter ring in the current text color. Stops spinning for reduced motion.
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      data-spinner
      viewBox="0 0 16 16"
      fill="none"
      className={["size-4 shrink-0 animate-spin motion-reduce:animate-none", className].filter(Boolean).join(" ")}
    >
      <circle cx="8" cy="8" r="6.9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="32.5 43.4" />
    </svg>
  );
}
