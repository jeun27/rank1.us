"use client";
import { useSyncExternalStore, type KeyboardEvent } from "react";
import { prefsSnapshot, resolveTheme, serverPrefs, subscribePrefs } from "@/lib/workspace/prefs";

const noop = () => () => {};

// False during SSR and hydration, true after: keeps browser-only values out of the server HTML.
export const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

export function usePrefs() {
  const prefs = useSyncExternalStore(subscribePrefs, prefsSnapshot, serverPrefs);
  const hydrated = useHydrated();
  return { ...prefs, theme: hydrated ? resolveTheme(prefs) : null };
}

// The current time, client only (freshness "Checked 2 d ago"), refreshed every minute.
let now: Date | null = null;
const subscribeNow = (l: () => void) => {
  const t = setInterval(() => {
    now = new Date();
    l();
  }, 60_000);
  return () => clearInterval(t);
};
export const useNow = () =>
  useSyncExternalStore(
    subscribeNow,
    () => (now ??= new Date()),
    () => null,
  );

// Roving tabindex for a horizontal tablist: arrows wrap, Home/End jump. Returns the new index or null.
export function rovingIndex(e: KeyboardEvent, i: number, n: number): number | null {
  const next =
    e.key === "ArrowRight"
      ? (i + 1) % n
      : e.key === "ArrowLeft"
        ? (i - 1 + n) % n
        : e.key === "Home"
          ? 0
          : e.key === "End"
            ? n - 1
            : null;
  if (next !== null) e.preventDefault();
  return next;
}
