import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aurora, colors, darkColors, radius, shadows } from "@/styles/tokens";

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
  it("dark (default) has the exact §7 values", () => {
    expect(darkColors).toEqual({
      paper: "#0E0F11",
      white: "#151619",
      raised: "#1C1E22",
      overlay: "#24262B",
      ink: "#EDEEF0",
      text2: "#B3B7BF",
      inkMuted: "#8C919B",
      border: "#2B2E34",
      borderStrong: "#41454D",
      fieldBorder: "#71767F",
      accent: "#279EF2",
      onAccent: "#0E0F11",
      jellyLoading: "#4FAEF7",
      jelly: "#279EF2",
      jellyDeep: "#79C0FA",
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
    expect(radius).toEqual({ control: 6, card: 8, surface: 8, banner: 8 });
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
    ]);
    for (const [name, value] of Object.entries(shadows)) expect(css).toContain(`--shadow-${name}: ${value};`);
    const declared = [...css.matchAll(/--shadow-([\w-]+):/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(shadows).sort());
    expect(css).not.toMatch(/box-shadow/);
  });

  // The theme comes from data-theme (set before paint by the theme script), never a CSS media query.
  it("has no media-query theme, and the aurora ring is the only gradient", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(aurora).toBe("linear-gradient(90deg, #E8B85A, #5FB8B3, #279EF2)");
    expect(css).toContain(`--aurora: ${aurora};`);
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
      ].sort(),
    );
  });

  it("components use shadow tokens only, and only AuroraButton uses the aurora ring", () => {
    for (const file of sources("src").filter((f) => !f.endsWith("globals.css") && !f.endsWith("tokens.ts"))) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/gradient\(|bg-(linear|radial|conic|gradient)|shadow-\[|box-shadow|boxShadow/);
      for (const m of src.matchAll(/\bshadow-([\w-]+)/g))
        expect(Object.keys(shadows), `${file}: ${m[0]}`).toContain(m[1]);
      if (!file.endsWith("AuroraButton.tsx")) expect(src, file).not.toContain("aurora-ring");
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
  it("Jelly blue is the fill and the chart line: ≥ 4.5 on page, panel and raised", () => {
    for (const bg of surfaces)
      expect(ratio(darkColors.accent, darkColors[bg]), `accent on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});
