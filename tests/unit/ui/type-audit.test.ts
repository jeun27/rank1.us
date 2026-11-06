import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// F1 type audit (lead, 2026-11-06): Inter + JetBrains Mono only, weights 400/500/600, no faux or italic
// styles, mono 400/500 only. Checks every class string in src/.
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
const sources = files("src").map((f) => [f, readFileSync(f, "utf8")] as const);
const classStrings = (src: string) =>
  [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2]);

describe("type audit", () => {
  it("uses no weight outside 400/500/600 and no italic", () => {
    const bad = sources.flatMap(([f, src]) =>
      classStrings(src)
        .filter((c) => /\b(font-(thin|extralight|light|bold|extrabold|black)|italic)\b/.test(c))
        .map((c) => `${f}: ${c}`),
    );
    expect(bad).toEqual([]);
  });

  it("never sets mono at 600 (JetBrains Mono is 400/500)", () => {
    const bad = sources.flatMap(([f, src]) =>
      classStrings(src)
        .filter((c) => /\bfont-mono\b/.test(c) && /\bfont-semibold\b/.test(c))
        .map((c) => `${f}: ${c}`),
    );
    expect(bad).toEqual([]);
  });

  it("loads only Inter and JetBrains Mono, through next/font", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect([...layout.matchAll(/import \{([^}]+)\} from "next\/font\/google"/g)].map((m) => m[1].trim())).toEqual([
      "Inter, JetBrains_Mono",
    ]);
    const fonts = sources.filter(([, src]) => /next\/font|fonts\.googleapis/.test(src)).map(([f]) => f);
    expect(fonts).toEqual(["src/app/layout.tsx"]);
  });
});
