import type { ReactNode } from "react";
import { ActionButton, type Action } from "./Button";
import { Icon } from "./Icon";
import { Jelly } from "./Jelly";

// v3 (UI.md "Error banner" / "Info banner"). Error: errorBg, a 1px error hairline at 30%, a 48px Jelly, one
// Inter 500 sentence and one fix action (text link). Info: infoBg, a 25% info hairline, a 28px "i" chip.
export function Banner({ tone, children, action }: { tone: "error" | "info"; children: ReactNode; action?: Action }) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-banner border py-2.5 pr-6 pl-3 ${
        error ? "border-brick/30 bg-errorBg text-brick" : "border-jellyDeep/25 bg-infoBg text-jellyDeep"
      }`}
    >
      {error ? (
        <Jelly size={48} decorative className="shrink-0" />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-infoBg">
          <Icon name="info" className="size-4.5" />
        </span>
      )}
      <p className={`min-w-0 flex-1 basis-40 ${error ? "font-medium" : ""}`}>{children}</p>
      {action && <ActionButton action={action} variant="secondary" />}
    </div>
  );
}
