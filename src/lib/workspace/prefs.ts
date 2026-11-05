// Team workspace settings kept in this browser: theme, pane split and sidebar collapse.
export type Theme = "light" | "dark";
export type Prefs = { theme: Theme | null; split: number; collapsed: boolean };

export const PREFS_KEY = "rank1.workspace";
export const DEFAULT_PREFS: Prefs = { theme: null, split: 50, collapsed: false };
export const SPLIT_MIN = 30;
export const SPLIT_MAX = 70;

const clampSplit = (n: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(n)));

export function readPrefs(): Prefs {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") ?? {};
  } catch {}
  return {
    theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : DEFAULT_PREFS.theme,
    split: typeof raw.split === "number" ? clampSplit(raw.split) : DEFAULT_PREFS.split,
    collapsed: typeof raw.collapsed === "boolean" ? raw.collapsed : DEFAULT_PREFS.collapsed,
  };
}

const systemTheme = (): Theme => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
export const resolveTheme = (p: Prefs): Theme => p.theme ?? systemTheme();

const listeners = new Set<() => void>();
let cache: Prefs | null = null;

export function writePrefs(patch: Partial<Prefs>) {
  const next = { ...readPrefs(), ...patch };
  next.split = clampSplit(next.split);
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  if (patch.theme) document.documentElement.dataset.theme = patch.theme;
  cache = null;
  listeners.forEach((l) => l());
}

// For useSyncExternalStore: a stable snapshot until the next write.
export const prefsSnapshot = () => (cache ??= readPrefs());
export const serverPrefs = () => DEFAULT_PREFS;
export function subscribePrefs(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Runs before first paint so the page never flashes the wrong theme.
export const themeScript = `(function(){var t;try{t=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}").theme}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t})()`;
