import type { ReactNode } from "react";
import { ActionButton, type Action } from "./Button";
import { Icon } from "./Icon";

// v3 (UI.md "Error banner" / "Info banner"). Error: errorBg, a 1px error hairline at 30%, an alert icon, one
// Inter 500 sentence and one fix action (text link). Info: infoBg, a 25% info hairline, an info icon. Both
// icons are bare 16px strokes on the first text line (DQ6); Jelly is for empty and loading moments only.
export function Banner({ tone, children, action }: { tone: "error" | "info"; children: ReactNode; action?: Action }) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-banner border px-4 py-2.5 ${
        error ? "border-brick/30 bg-errorBg text-brick" : "border-jellyDeep/25 bg-infoBg text-jellyDeep"
      }`}
    >
      <div className="flex min-w-0 flex-1 basis-40 gap-2.5">
        <span data-first-line className="flex h-[1lh] shrink-0 items-center">
          <Icon name={error ? "alert" : "info"} className="size-4" />
        </span>
        <p className={`min-w-0 flex-1 ${error ? "font-medium" : ""}`}>{children}</p>
      </div>
      {action && <ActionButton action={action} variant="secondary" />}
    </div>
  );
}
