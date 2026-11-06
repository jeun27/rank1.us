import type { ReactNode } from "react";
import { ActionButton, type Action } from "./Button";
import { Icon } from "./Icon";
import { Jelly } from "./Jelly";

// v3 (UI.md "Error banner" / "Info banner"). Error: errorBg, a 1px error hairline at 30%, a 48px Jelly, one
// Inter 500 sentence and one fix action (text link). Info: infoBg, a 25% info hairline, a 28px "i" chip.
// Warn (PR 27, lead): warnBg/warnText, a status, for something that needs attention; its action may be the
// screen's one filled button (`primary`).
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
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-banner border py-2.5 pr-6 pl-3 ${TONE[tone]}`}
    >
      {error ? (
        <Jelly size={48} decorative className="shrink-0" />
      ) : (
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${tone === "warn" ? "bg-warnBg" : "bg-infoBg"}`}
        >
          <Icon name="info" className="size-4.5" />
        </span>
      )}
      <p className={`min-w-0 flex-1 basis-40 ${error ? "font-medium" : ""}`}>{children}</p>
      {action && <ActionButton action={action} variant={primary ? "primary" : "secondary"} />}
    </div>
  );
}
