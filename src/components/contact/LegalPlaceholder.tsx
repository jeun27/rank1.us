import type { ReactNode } from "react";
import { SimplePage } from "./SimplePage";

export const LEGAL_MARKER = "[LEGAL REVIEW NEEDED]";
export const LEGAL_UPDATED = "2026-11-05";

// Placeholder legal page: the review marker first, then the last-updated date.
// `updated` overrides the shared date for a page changed on its own (YYYY-MM-DD).
export function LegalPlaceholder({
  title,
  updated: date = LEGAL_UPDATED,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  const updated = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  });
  return (
    <SimplePage
      title={title}
      notice={<p className="bg-warnBg px-5 py-3 text-center font-semibold text-warnText">{LEGAL_MARKER}</p>}
    >
      <p className="mb-8 text-caption text-inkMuted">
        Last updated <time dateTime={date}>{updated}</time>
      </p>
      <div className="flex flex-col gap-6 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-h3 [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </SimplePage>
  );
}
