import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aurora, colors, radius, shadows } from "@/styles/tokens";

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

  it("has no dark mode, and the aurora ring is the only gradient", () => {
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
