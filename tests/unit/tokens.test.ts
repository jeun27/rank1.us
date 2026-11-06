import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aurora, colors, darkColors, glow, headingGradient, radius, shadows } from "@/styles/tokens";

// v3 (design/direction.md §7, founder 2026-11-06): dark by default on every surface, O2 light on /app and
// /team. `darkColors` is the default @theme; `colors` is the light theme (also the PDF report and PNG).
const css = readFileSync("src/app/globals.css", "utf8");
const block = (start: string) => css.slice(css.indexOf(start), css.indexOf("}", css.indexOf(start)));
const theme = block("@theme {");
const light = block('[data-theme="light"] {');

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [join(dir, e.name)] : [],
  );

describe("Tailwind theme matches the v3 tokens", () => {
  // Portal look (founder 2026-11-06, lead OK): pure black surfaces, white accent, hairlines rgba(55,65,81,.55).
  it("dark (default) has the portal values", () => {
    expect(darkColors).toEqual({
      paper: "#000000",
      white: "#0A0A0A",
      raised: "#111214",
      overlay: "#18191B",
      ink: "#EDEEF0",
      text2: "#B3B7BF",
      inkMuted: "#8C919B",
      border: "rgba(55, 65, 81, 0.55)",
      borderStrong: "#41454D",
      fieldBorder: "#71767F",
      // White primary buttons with black text; hover #E5E5E5. Jelly (the mascot) keeps its own blue.
      accent: "#FFFFFF",
      onAccent: "#000000",
      jellyLoading: "#E5E5E5",
      jelly: "#279EF2",
      // R2: the blue info pair (infoBg + jellyDeep) stays for "You", info banners and focus rings.
      jellyDeep: "#79C0FA",
      // R1: links are white and always underlined (a non-colour cue).
      link: "#FFFFFF",
      moss: "#5FBF8E",
      successBg: "#13291F",
      brick: "#F08A7E",
      errorBg: "#33191A",
      amber: "#D98E2B",
      warnText: "#E8B45F",
      warnBg: "#2E2312",
      infoBg: "#14263B",
      auroraAmber: "#E8B85A",
      auroraTeal: "#5FB8B3",
      // Chart series (lead, v3 PR 1: supersedes Step 9 Q3 O1), validated on the dark panel.
      series1: "#3987E5",
      series2: "#D95926",
      series3: "#199E70",
      // The rail is black in both themes (portal look).
      rail: "#000000",
    });
  });

  it("light (O2) has the exact §7 values, with the same names", () => {
    expect(colors).toEqual({
      paper: "#F6F7F9",
      white: "#FFFFFF",
      raised: "#F0F2F5",
      overlay: "#E8EBEF",
      ink: "#111316",
      text2: "#4A4F57",
      inkMuted: "#646A73",
      border: "#E2E5EA",
      borderStrong: "#CDD1D8",
      fieldBorder: "#7D838D",
      accent: "#1A5FBF",
      onAccent: "#FFFFFF",
      jellyLoading: "#18579F",
      jelly: "#279EF2",
      jellyDeep: "#1A5FBF",
      link: "#1A5FBF",
      moss: "#2F6F4F",
      successBg: "#E6EFE9",
      brick: "#B3443A",
      errorBg: "#F7E6E3",
      amber: "#D98E2B",
      warnText: "#8A5A12",
      warnBg: "#FBEFD9",
      infoBg: "#E5EFFC",
      auroraAmber: "#E8B85A",
      auroraTeal: "#5FB8B3",
      // Light keeps the Step 9 hues for the 3 solids.
      series1: "#1A5FBF",
      series2: "#D98E2B",
      series3: "#279EF2",
      rail: "#0B0C0E",
    });
    expect(Object.keys(colors).sort()).toEqual(Object.keys(darkColors).sort());
  });

  it("declares dark in @theme, light in [data-theme=light], and dark again for nested dark subtrees", () => {
    for (const [name, value] of Object.entries(darkColors)) expect(theme).toContain(`--color-${name}: ${value};`);
    for (const [name, value] of Object.entries(colors)) expect(light).toContain(`--color-${name}: ${value};`);
    expect(theme).toContain("--color-*: initial;");
    const declared = [...theme.matchAll(/--color-([\w]+):/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(darkColors).sort());
    // The rail stays dark inside a light page (D14): a nested [data-theme=dark] restores the dark values.
    const dark = block('[data-theme="dark"] {');
    for (const [name, value] of Object.entries(darkColors)) expect(dark).toContain(`--color-${name}: ${value};`);
    expect(css.indexOf('[data-theme="dark"] {')).toBeGreaterThan(css.indexOf('[data-theme="light"] {'));
  });

  it("has the v3 radius and shadow tokens, and no other shadows", () => {
    // UI.md radius tag (badges and tags, lead C1) and frame (the 10-12px landing frames, v3 PR 3).
    expect(radius).toEqual({ control: 6, card: 8, surface: 8, banner: 8, tag: 4, frame: 12 });
    for (const [name, px] of Object.entries(radius)) expect(css).toContain(`--radius-${name}: ${px}px;`);
    expect(Object.keys(shadows).sort()).toEqual([
      "aurora",
      "banner-error",
      "button",
      "card",
      "field",
      "fill",
      "overlay",
      "track",
      "window",
    ]);
    // UI.md: shadow-window is the landing demo window only.
    expect(shadows.window).toBe("0 30px 80px -20px rgb(0 0 0 / 0.7)");
    for (const [name, value] of Object.entries(shadows)) expect(css).toContain(`--shadow-${name}: ${value};`);
    const declared = [...css.matchAll(/--shadow-([\w-]+):/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(shadows).sort());
    expect(css).not.toMatch(/box-shadow/);
  });

  // v3 (UI.md type table, lead C3): one size at every breakpoint. UI body 13/19, caption 12/16, tag 11/1.
  it("has the UI.md app type scale: ui 13/19, caption 12/16, tag 11/1", () => {
    for (const d of [
      "--text-ui: 13px;",
      "--text-ui--line-height: 19px;",
      "--text-caption: 12px;",
      "--text-caption--line-height: 16px;",
      "--text-tag: 11px;",
      "--text-tag--line-height: 1;",
    ])
      expect(css).toContain(d);
  });

  // X6 (UI.md D33): the app page title is 22/28 at every width; the hero number sits in the 36-44 range.
  it("has the UI.md title 22/28 and hero 44/48", () => {
    for (const d of [
      "--text-title: 22px;",
      "--text-title--line-height: 28px;",
      "--text-hero: 44px;",
      "--text-hero--line-height: 48px;",
    ])
      expect(css).toContain(d);
  });

  // F1 (UI.md type table): section and card titles are 13/18; no faux bold/italic; numbers are tabular.
  it("has the section title 13/18, no font synthesis, and tabular numbers on data", () => {
    expect(css).toContain("--text-section: 13px;");
    expect(css).toContain("--text-section--line-height: 18px;");
    expect(css).toMatch(/html \{[^}]*font-synthesis: none;/);
    expect(css).toMatch(/\[data-computed\],\s*\.font-mono,\s*td,\s*th \{\s*font-variant-numeric: tabular-nums;\s*\}/);
  });

  // R2 (lead): fields stay 16px below md, so iPhone Safari doesn't zoom on focus. Unlayered, so it wins.
  it("keeps form fields at 16px below md", () => {
    expect(css).toMatch(/@media \(width < 48rem\) \{\s*input,\s*select,\s*textarea \{ font-size: 16px; \}\s*\}/);
  });

  // The theme comes from data-theme (set before paint by the theme script), never a CSS media query.
  // D39 (approved 2026-11-06): the accent glow joins the aurora ring. Both live in globals.css only.
  it("has no media-query theme; the only gradients are the aurora ring and the accent glow", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(aurora).toBe("linear-gradient(90deg, #E8B85A, #5FB8B3, #279EF2)");
    expect(css).toContain(`--aurora: ${aurora};`);
    expect(glow).toBe("radial-gradient(closest-side, rgb(39 158 242 / 0.18), transparent)");
    expect(css).toContain(`--glow: ${glow};`);
    // Portal look: h1/h2 in /app, /team and /client fade from white to 60% white (7.6:1 at the light end).
    expect(headingGradient).toBe("linear-gradient(180deg, #FFFFFF, rgb(255 255 255 / 0.6))");
    expect(css).toContain(`--heading-gradient: ${headingGradient};`);
    // Forced colours (Windows high contrast): plain text, no clipped background.
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*heading-gradient|heading-gradient[\s\S]*@media \(forced-colors: active\)/,
    );
    const gradients = [...css.matchAll(/[\w-]*gradient\(/g)].map((m) => {
      let depth = 0;
      for (let i = m.index + m[0].length - 1; i < css.length; i++) {
        depth += css[i] === "(" ? 1 : css[i] === ")" ? -1 : 0;
        if (depth === 0) return css.slice(m.index, i + 1);
      }
      return css.slice(m.index);
    });
    expect(gradients.sort()).toEqual(
      [
        "linear-gradient(90deg, #E8B85A, #5FB8B3, #279EF2)",
        "linear-gradient(var(--color-white), var(--color-white))",
        "radial-gradient(closest-side, rgb(39 158 242 / 0.18), transparent)",
        "linear-gradient(180deg, #FFFFFF, rgb(255 255 255 / 0.6))",
      ].sort(),
    );
  });

  it("components use shadow tokens only, only AuroraButton uses the aurora ring, the glow is landing-only", () => {
    for (const file of sources("src").filter((f) => !f.endsWith("globals.css") && !f.endsWith("tokens.ts"))) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/gradient\(|bg-(linear|radial|conic|gradient)|shadow-\[|box-shadow|boxShadow/);
      for (const m of src.matchAll(/\bshadow-([\w-]+)/g))
        expect(Object.keys(shadows), `${file}: ${m[0]}`).toContain(m[1]);
      if (!file.endsWith("AuroraButton.tsx")) expect(src, file).not.toContain("aurora-ring");
      if (!file.includes("components/site/")) expect(src, file).not.toMatch(/\bglow\b/);
      // The heading gradient is the portal's (app, team, client), never the landing's.
      if (file.includes("components/site/")) expect(src, file).not.toContain("heading-gradient");
      if (!file.endsWith("HeroDemo.tsx")) expect(src, file).not.toContain("shadow-window");
    }
  });
});

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

type Name = keyof typeof colors;
// §7 "Contrast checked": text ≥ 4.5 on every surface it sits on; control edges ≥ 3.
const surfaces: Name[] = ["paper", "white", "raised"];
const textOn: [Name, Name[]][] = [
  ["ink", [...surfaces, "overlay"]],
  ["text2", [...surfaces, "overlay"]],
  ["inkMuted", surfaces],
  ["jellyDeep", surfaces],
  ["link", surfaces],
  ["onAccent", ["accent", "jellyLoading"]],
  ["moss", ["successBg", "white"]],
  ["brick", ["errorBg", "white"]],
  ["warnText", ["warnBg", "white"]],
  ["jellyDeep", ["infoBg"]],
];

describe.each([
  ["dark", darkColors],
  ["light", colors],
] as const)("%s theme contrast (§7)", (_, p) => {
  it("every text pair passes AA (4.5)", () => {
    for (const [fg, bgs] of textOn)
      for (const bg of bgs) expect(ratio(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("control edges pass 3:1 on page and panel", () => {
    for (const bg of ["white", "paper"] as const)
      expect(ratio(p.fieldBorder, p[bg]), `fieldBorder on ${bg}`).toBeGreaterThanOrEqual(3);
  });
});

describe("dark accent", () => {
  // R3: the accent (white) is the fill and the business chart line.
  it("the white accent is the fill and the chart line: ≥ 4.5 on page, panel and raised", () => {
    for (const bg of surfaces)
      expect(ratio(darkColors.accent, darkColors[bg]), `accent on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});

// UI.md Motion: app motion 120–260ms on one curve, cubic-bezier(.16,1,.3,1). The landing demo (the one
// focal moment) may run longer. Durations come from the default or the duration scale, never one-offs.
describe("motion tokens", () => {
  const motionTheme = css.slice(css.indexOf("/* Motion tokens"));
  it("defines the one ease and a 150ms default for every transition", () => {
    expect(motionTheme).toMatch(/--ease-out:\s*cubic-bezier\(0?\.16,\s*1,\s*0?\.3,\s*1\)/);
    expect(motionTheme).toMatch(/--default-transition-duration:\s*150ms/);
    expect(motionTheme).toMatch(/--default-transition-timing-function:\s*var\(--ease-out\)/);
  });

  it("no component hard-codes a curve or a duration outside 120–260ms (the landing demo excepted)", () => {
    for (const file of sources("src")) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/ease-\[cubic-bezier/);
      if (file.includes("site/HeroDemo")) continue;
      for (const [, ms] of text.matchAll(/\bduration-(\d+)\b/g))
        expect(Number(ms), `${file} duration-${ms}`).toBeGreaterThanOrEqual(120);
    }
  });
});
