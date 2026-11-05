import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aurora, colors, darkColors, radius, shadows } from "@/styles/tokens";

const css = readFileSync("src/app/globals.css", "utf8");
const theme = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [join(dir, e.name)] : [],
  );

describe("Tailwind theme matches docs/UI.md tokens", () => {
  it("has the exact UI.md color values", () => {
    expect(colors).toEqual({
      paper: "#F7F4EE",
      ink: "#1E2320",
      inkMuted: "#5C625E",
      moss: "#2F6F4F",
      amber: "#D98E2B",
      brick: "#B3443A",
      jelly: "#279EF2",
      jellyDeep: "#1A5FBF",
      border: "rgb(30 35 32 / 0.15)",
      successBg: "#E6EFE9",
      errorBg: "#F7E6E3",
      warnBg: "#FBEFD9",
      warnText: "#8A5A12",
      infoBg: "#E3EEFB",
      white: "#FFFFFF",
      jellyLoading: "#316FC5",
      fieldBorder: "rgb(30 35 32 / 0.5)",
      auroraAmber: "#E8B85A",
      auroraTeal: "#5FB8B3",
      raised: "#FFFFFF",
    });
  });

  it("declares every token in the @theme block", () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(theme).toContain(`--color-${name}: ${value};`);
    }
  });

  it("removes Tailwind's default palette so no other colors can be used", () => {
    expect(theme).toContain("--color-*: initial;");
    const declared = [...theme.matchAll(/--color-([\w]+):/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(colors).sort());
  });

  it("has the exact Final set radius and shadow tokens, and no other shadows", () => {
    expect(radius).toEqual({ card: 8, surface: 24, banner: 28 });
    for (const [name, px] of Object.entries(radius)) expect(css).toContain(`--radius-${name}: ${px}px;`);
    expect(Object.keys(shadows).sort()).toEqual(["aurora", "banner-error", "button", "card", "field", "fill", "track"]);
    for (const [name, value] of Object.entries(shadows)) expect(css).toContain(`--shadow-${name}: ${value};`);
    const declared = [...css.matchAll(/--shadow-([\w-]+):/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(shadows).sort());
    expect(css).not.toMatch(/box-shadow/);
  });

  // Dark mode exists only as the team workspace theme (ENG_HANDOFF_STEP2 §3), set by data-theme, never by CSS media.
  it("has no media-query dark mode, and the aurora ring is the only gradient", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(aurora).toBe("linear-gradient(90deg, #E8B85A, #5FB8B3, #279EF2)");
    expect(css).toContain(`--aurora: ${aurora};`);
    // Every gradient in the CSS is either the aurora token or the solid white padding layer of the ring.
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

const dark = css.slice(css.indexOf('[data-theme="dark"] {'), css.indexOf("}", css.indexOf('[data-theme="dark"] {')));
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("team workspace dark theme", () => {
  it("overrides every color token, and only inside [data-theme=dark]", () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(colors).sort());
    for (const [name, value] of Object.entries(darkColors)) expect(dark).toContain(`--color-${name}: ${value};`);
  });

  // Text pairs the workspace and the Final set components use. AA: 4.5 for text, 3 for field edges.
  const text: [keyof typeof colors, keyof typeof colors][] = [
    ["ink", "paper"],
    ["ink", "white"],
    ["ink", "raised"],
    ["inkMuted", "paper"],
    ["inkMuted", "white"],
    ["inkMuted", "raised"],
    ["jellyDeep", "white"],
    ["jellyDeep", "paper"],
    ["jellyDeep", "raised"],
    ["white", "jellyDeep"],
    ["white", "jellyLoading"],
    ["moss", "white"],
    ["brick", "white"],
    ["moss", "successBg"],
    ["brick", "errorBg"],
    ["warnText", "warnBg"],
    ["jellyDeep", "infoBg"],
  ];
  it.each([
    ["light", colors],
    ["dark", darkColors],
  ] as const)("%s: every text pair passes AA", (_, palette) => {
    for (const [fg, bg] of text) expect(ratio(palette[fg], palette[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("dark: the accent works as text and the field edge is visible", () => {
    for (const bg of ["paper", "white", "raised"] as const) {
      expect(ratio(darkColors.amber, darkColors[bg]), `amber on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(darkColors.fieldBorder, darkColors[bg]), `fieldBorder on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });
});
