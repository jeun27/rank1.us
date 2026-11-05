import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { copy } from "@/app/app/onboarding/copy";

const copyMd = readFileSync("docs/COPY.md", "utf8");
// Each templated string, filled the way COPY.md writes it ({cuisine}, {city}, question 7, {Engine}).
const filled = (key: string, v: unknown): string[] => {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v;
  if (typeof v === "function")
    return [
      key === "step"
        ? v(1)
        : key === "emptyQuestion"
          ? v(7)
          : key === "cityNote"
            ? v("{Engine}")
            : v("{cuisine}", "{city}"),
    ];
  return Object.values(v as Record<string, string>);
};

describe("onboarding copy", () => {
  it("uses only strings that are in docs/COPY.md", () => {
    const strings = Object.entries(copy).flatMap(([k, v]) => filled(k, v));
    expect(strings.length).toBeGreaterThan(35);
    for (const s of strings) expect(copyMd, s).toContain(s);
  });
});
