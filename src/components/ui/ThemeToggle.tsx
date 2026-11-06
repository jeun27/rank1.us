"use client";
import { usePrefs } from "@/components/workspace/hooks";
import { writePrefs } from "@/lib/workspace/prefs";
import { Icon } from "./Icon";

const focus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";

// The O2 toggle (v3) for /app, sharing /team's stored choice and its "Dark theme" label. labelled: the
// phone Account menu row (X9a), a switch with its label and a visible on/off track (#145 review).
export function ThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const { theme } = usePrefs();
  const dark = theme === "dark";
  const flip = () => writePrefs({ theme: dark ? "light" : "dark" });
  if (labelled)
    return (
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Dark theme"
        onClick={flip}
        className={`flex h-11 w-full items-center gap-2 rounded-control px-3 text-ui text-ink hover:bg-raised ${focus}`}
      >
        <Icon name="moon" className="size-4" />
        <span aria-hidden className="flex-1 text-left whitespace-nowrap">
          Dark theme
        </span>
        <span
          aria-hidden
          data-switch-track
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border ${
            dark ? "border-accent bg-accent" : "border-fieldBorder bg-overlay"
          }`}
        >
          <span
            className={`size-3.5 rounded-full transition-transform motion-reduce:transition-none ${
              dark ? "translate-x-4 bg-onAccent" : "translate-x-0.5 bg-ink"
            }`}
          />
        </span>
      </button>
    );
  return (
    <button
      type="button"
      aria-label="Dark theme"
      aria-pressed={dark}
      onClick={flip}
      className={`grid size-11 place-items-center rounded-control text-inkMuted hover:bg-raised hover:text-ink ${focus}`}
    >
      <Icon name="moon" className="size-4" />
    </button>
  );
}
