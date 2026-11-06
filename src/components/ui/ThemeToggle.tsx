"use client";
import { usePrefs } from "@/components/workspace/hooks";
import { writePrefs } from "@/lib/workspace/prefs";
import { Icon } from "./Icon";

// The O2 toggle (v3) for /app, sharing /team's stored choice and its "Dark theme" label.
export function ThemeToggle() {
  const { theme } = usePrefs();
  return (
    <button
      type="button"
      aria-label="Dark theme"
      aria-pressed={theme === "dark"}
      onClick={() => writePrefs({ theme: theme === "dark" ? "light" : "dark" })}
      className="grid size-11 place-items-center rounded-control text-inkMuted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
    >
      <Icon name="moon" className="size-4" />
    </button>
  );
}
