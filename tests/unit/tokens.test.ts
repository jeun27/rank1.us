import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors } from "@/styles/tokens";

const css = readFileSync("src/app/globals.css", "utf8");
const theme = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));

describe("Tailwind theme matches docs/UI.md tokens", () => {
  it("has the exact UI.md color values", () => {
    expect(colors).toEqual({
      paper: "#F7F4EE", ink: "#1E2320", inkMuted: "#5C625E", moss: "#2F6F4F", amber: "#D98E2B",
      brick: "#B3443A", jelly: "#279EF2", jellyDeep: "#1A5FBF", border: "rgb(30 35 32 / 0.15)",
      successBg: "#E6EFE9", errorBg: "#F7E6E3", warnBg: "#FBEFD9", warnText: "#8A5A12", infoBg: "#E3EEFB",
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
    expect(declared.sort()).toEqual([...Object.keys(colors), "white"].sort());
  });

  it("has no dark mode, gradients or shadows", () => {
    expect(css).not.toMatch(/prefers-color-scheme|gradient|box-shadow/);
  });
});
