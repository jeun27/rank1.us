"use client";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { themeFor } from "@/lib/theme";
import { readPrefs } from "@/lib/workspace/prefs";

// The head script sets data-theme on a full load; this re-applies the same rule after client-side
// navigation, so a saved light theme never carries onto the forced-dark public pages (#92 review). A
// layout effect, so it lands in the same commit as the new page, with no one-frame flash.
export function ThemeSync() {
  const path = usePathname();
  useLayoutEffect(() => {
    const prefersLight = matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.dataset.theme = themeFor(path, readPrefs().theme, prefersLight);
  }, [path]);
  return null;
}
