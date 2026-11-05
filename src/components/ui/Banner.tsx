import type { ReactNode } from "react";
import { ActionButton, type Action } from "./Button";
import { Icon } from "./Icon";
import { Jelly } from "./Jelly";

// Error: one sentence + one fix action (text link), with a 64px Jelly. Info: plain note with an "i" chip.
export function Banner({ tone, children, action }: { tone: "error" | "info"; children: ReactNode; action?: Action }) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-banner border-[1.5px] bg-white py-2.5 pr-6 pl-3 ${
        error ? "border-brick text-brick shadow-banner-error" : "border-jellyDeep text-jellyDeep shadow-field"
      }`}
    >
      {error ? (
        <Jelly size={64} decorative className="shrink-0" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-infoBg">
          <Icon name="info" className="size-4.5" />
        </span>
      )}
      <p className={`min-w-0 flex-1 basis-40 ${error ? "font-semibold" : ""}`}>{children}</p>
      {action && <ActionButton action={action} variant="secondary" />}
    </div>
  );
}
