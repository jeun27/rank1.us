import type { ReactNode } from "react";

const tones = {
  success: "bg-successBg text-moss",
  error: "bg-errorBg text-brick",
  warn: "bg-warnBg text-warnText",
  info: "bg-infoBg text-jellyDeep",
};

export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 text-caption tabular-nums ${tones[tone]}`}>
      {children}
    </span>
  );
}
