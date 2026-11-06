import { describe, expect, it } from "vitest";
import { themeFor, themeScript } from "@/lib/theme";

// v3 O1/O2 (lead, 2026-11-06): public pages are always dark; /app, /team (and /client, /dev galleries) use
// the saved choice, else prefers-color-scheme on the first visit, else dark. The script runs before paint.
describe("themeFor", () => {
  it.each(["/", "/audit/AbC", "/signin", "/privacy", "/contact", "/admin/test"])("public %s is always dark", (path) => {
    expect(themeFor(path, "light", true)).toBe("dark");
    expect(themeFor(path, null, true)).toBe("dark");
  });

  it.each(["/app", "/app/billing", "/team", "/client", "/dev/app"])("%s: saved choice wins", (path) => {
    expect(themeFor(path, "light", false)).toBe("light");
    expect(themeFor(path, "dark", true)).toBe("dark");
  });

  it("first visit to /app with prefers-color-scheme: light is light; otherwise dark", () => {
    expect(themeFor("/app", null, true)).toBe("light");
    expect(themeFor("/app", null, false)).toBe("dark");
    expect(themeFor("/application", null, true)).toBe("dark");
  });
});

describe("themeScript", () => {
  const run = (path: string, saved: string | null, prefersLight: boolean) => {
    const html = { dataset: {} as Record<string, string>, classList: new Set<string>() };
    const g = {
      location: { pathname: path },
      localStorage: { getItem: () => (saved === null ? null : JSON.stringify({ theme: saved })) },
      matchMedia: (q: string) => ({ matches: q.includes("light") ? prefersLight : !prefersLight }),
      document: { documentElement: html },
    };
    new Function("location", "localStorage", "matchMedia", "document", themeScript)(
      g.location,
      g.localStorage,
      g.matchMedia,
      g.document,
    );
    return html.dataset.theme;
  };

  it("sets data-theme with the same rule as themeFor", () => {
    for (const path of ["/", "/audit/x", "/app", "/team", "/client"])
      for (const saved of [null, "light", "dark"])
        for (const prefersLight of [true, false])
          expect(run(path, saved, prefersLight), `${path} ${saved} ${prefersLight}`).toBe(
            themeFor(path, saved as "light" | "dark" | null, prefersLight),
          );
  });

  it("survives blocked storage (falls back to the media query)", () => {
    const html = { dataset: {} as Record<string, string>, classList: new Set<string>() };
    new Function("location", "localStorage", "matchMedia", "document", themeScript)(
      { pathname: "/app" },
      {
        getItem: () => {
          throw new Error("blocked");
        },
      },
      () => ({ matches: true }),
      { documentElement: html },
    );
    expect(html.dataset.theme).toBe("light");
    expect(html.classList.has("js")).toBe(true);
  });

  // v3 PR 2b (lead): no-JS fallbacks (the /team client switcher's GET form) show only without .js, and
  // the JS controls only with it. Set before paint on every path, so nothing swaps after load.
  it("adds the js class to <html> on every path", () => {
    for (const path of ["/", "/team", "/app", "/contact"]) {
      const html = { dataset: {} as Record<string, string>, classList: new Set<string>() };
      new Function("location", "localStorage", "matchMedia", "document", themeScript)(
        { pathname: path },
        { getItem: () => null },
        () => ({ matches: false }),
        { documentElement: html },
      );
      expect([...html.classList], path).toEqual(["js"]);
    }
  });
});

describe("ThemeSync", () => {
  it("re-applies the rule when the path changes (client-side navigation)", async () => {
    const { render } = await import("@testing-library/react");
    const { vi } = await import("vitest");
    const nav = { path: "/team" };
    vi.doMock("next/navigation", () => ({ usePathname: () => nav.path }));
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    localStorage.setItem("rank1.workspace", JSON.stringify({ theme: "light" }));
    const { ThemeSync } = await import("@/components/ui/ThemeSync");
    const { rerender } = render(<ThemeSync />);
    expect(document.documentElement.dataset.theme).toBe("light");
    nav.path = "/contact";
    rerender(<ThemeSync key="2" />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    localStorage.clear();
    vi.unstubAllGlobals();
  });
});
