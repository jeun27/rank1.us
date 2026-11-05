import type { ReactNode } from "react";
import { ActionButton, type Action } from "./Button";
import { Jelly } from "./Jelly";

// Error: one sentence + one fix action, with a 64px Jelly. Info: plain note.
export function Banner({ tone, children, action }: { tone: "error" | "info"; children: ReactNode; action?: Action }) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-center gap-4 rounded-card px-4 py-3 ${error ? "bg-errorBg text-brick" : "bg-infoBg text-jellyDeep"}`}
    >
      {error && <Jelly size={64} decorative className="shrink-0" />}
      <p className="flex-1">{children}</p>
      {action && <ActionButton action={action} variant="secondary" />}
    </div>
  );
}
