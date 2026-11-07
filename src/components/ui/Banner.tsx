import type { ReactNode } from "react";
import { ActionButton, type Action } from "./Button";
import { Icon } from "./Icon";

// v3 (UI.md "Error banner" / "Info banner"). Error: errorBg, a 1px error hairline at 30%, an alert icon, one
// Inter 500 sentence and one fix action (text link). Info: infoBg, a 25% info hairline, an info icon.
// Warn (PR 27, lead): warnBg/warnText, a status, for something that needs attention, with an alert icon; its
// action may be the screen's one filled button (`primary`). Every icon is a bare 16px stroke on the first
// text line (DQ6); Jelly is for empty and loading moments only.
const TONE = {
  error: "border-brick/30 bg-errorBg text-brick",
  info: "border-jellyDeep/25 bg-infoBg text-jellyDeep",
  warn: "border-warnText/30 bg-warnBg text-warnText",
};
export function Banner({
  tone,
  children,
  action,
  primary = false,
}: {
  tone: "error" | "info" | "warn";
  children: ReactNode;
  action?: Action;
  primary?: boolean;
}) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-banner border px-4 py-2.5 ${TONE[tone]}`}
    >
      <div className="flex min-w-0 flex-1 basis-40 gap-2.5">
        <span data-first-line className="flex h-[1lh] shrink-0 items-center">
          <Icon name={tone === "info" ? "info" : "alert"} className="size-4" />
        </span>
        <p className={`min-w-0 flex-1 ${error ? "font-medium" : ""}`}>{children}</p>
      </div>
      {action && <ActionButton action={action} variant={primary ? "primary" : "secondary"} />}
    </div>
  );
}
