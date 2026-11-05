import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formCopy } from "@/components/forms/copy";
import { TIERS } from "@/lib/spam/validate";

const copyMd = readFileSync("docs/COPY.md", "utf8");

describe("form copy", () => {
  it("has no [PLACEHOLDER] left in src/components/forms/copy.ts", () => {
    expect(readFileSync("src/components/forms/copy.ts", "utf8")).not.toContain("[PLACEHOLDER]");
  });

  it("uses only strings that are in docs/COPY.md", () => {
    const strings = Object.values(formCopy).map((v) => (typeof v === "function" ? v("{email}") : v));
    for (const s of [...strings, ...TIERS]) expect(copyMd, s).toContain(s);
  });
});
