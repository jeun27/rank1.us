import type { HTMLAttributes, ReactNode } from "react";

const tones = {
  success: "bg-successBg text-moss",
  error: "bg-errorBg text-brick",
  warn: "bg-warnBg text-warnText",
  info: "bg-infoBg text-jellyDeep",
  // A plain hint with no state (e.g. a "checked country-wide" location tag).
  neutral: "bg-raised text-text2",
};

// v3 (UI.md "Badge / tag"): radius 4, 20h, Inter 500 11px, state fill + text + a 25% state-colour hairline.
// Extra attributes (a title tooltip, data-*) go on the tag itself.
export function Badge({
  tone,
  children,
  ...rest
}: { tone: keyof typeof tones; children: ReactNode } & Omit<HTMLAttributes<HTMLSpanElement>, "className">) {
  return (
    <span
      {...rest}
      className={`inline-flex h-5 items-center rounded-tag border border-current/25 px-1.5 text-tag font-medium whitespace-nowrap tabular-nums ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
