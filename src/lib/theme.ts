import { PREFS_KEY } from "@/lib/workspace/prefs";

export type Theme = "light" | "dark";

// v3 (O1/O2, lead 2026-11-06): public pages are always dark. /app, /team, /client and the /dev galleries
// use the saved choice, else prefers-color-scheme on the first visit, else dark. The server renders
// data-theme="dark", so a public page never changes after paint and an app page changes before it.
const THEMED = /^\/(app|team|client|dev)(\/|$)/;

export function themeFor(path: string, saved: Theme | null, prefersLight: boolean): Theme {
  if (!THEMED.test(path)) return "dark";
  return saved ?? (prefersLight ? "light" : "dark");
}

// The same rule, as an inline script in the root layout's <head>: it runs before the first paint. It also
// adds .js to <html>, so no-JS fallbacks (.nojs-only) and JS controls (.js-only) never swap after load.
// tests/unit/theme.test.ts checks it agrees with themeFor for every path, saved value and system setting.
export const themeScript = `(function(){document.documentElement.classList.add("js");var t=null;if(${THEMED}.test(location.pathname)){try{t=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}").theme}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t||"dark"})()`;
