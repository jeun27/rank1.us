"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { themeFor } from "@/lib/theme";
import { readPrefs } from "@/lib/workspace/prefs";

// The head script sets data-theme on a full load; this re-applies the same rule after client-side
// navigation, so a saved light theme never carries onto the forced-dark public pages (#92 review).
export function ThemeSync() {
  const path = usePathname();
  useEffect(() => {
    const prefersLight = matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.dataset.theme = themeFor(path, readPrefs().theme, prefersLight);
  }, [path]);
  return null;
}
