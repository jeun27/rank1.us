import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, PREFS_KEY, readPrefs, resolveTheme, themeScript, writePrefs } from "@/lib/workspace/prefs";

// jsdom has no matchMedia.
const mockSystem = (dark: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: dark && q === "(prefers-color-scheme: dark)", media: q }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("workspace prefs", () => {
  it("defaults: system theme, 50/50 split, sidebar open", () => {
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({ theme: null, split: 50, collapsed: false });
  });

  it("follows the system theme until the user picks one", () => {
    mockSystem(true);
    expect(resolveTheme(readPrefs())).toBe("dark");
    writePrefs({ theme: "light" });
    expect(resolveTheme(readPrefs())).toBe("light");
  });

  it("persists theme, split and collapse together in localStorage and applies the theme", () => {
    writePrefs({ theme: "dark" });
    writePrefs({ split: 62 });
    writePrefs({ collapsed: true });
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ theme: "dark", split: 62, collapsed: true });
    expect(readPrefs()).toEqual({ theme: "dark", split: 62, collapsed: true });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("clamps the split to 30-70 and ignores junk", () => {
    writePrefs({ split: 95 });
    expect(readPrefs().split).toBe(70);
    localStorage.setItem(PREFS_KEY, '{"theme":"purple","split":"wide","collapsed":"yes"}');
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
    localStorage.setItem(PREFS_KEY, "not json");
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("the pre-paint script sets data-theme from storage, else from the system", () => {
    mockSystem(true);
    new Function(themeScript)();
    expect(document.documentElement.dataset.theme).toBe("dark");
    localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: "light" }));
    new Function(themeScript)();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
