import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditCopy } from "@/components/audit/copy";
import { ENGINES } from "@/components/audit/contract";

const copyMd = readFileSync("docs/COPY.md", "utf8");

describe("audit copy", () => {
  it("uses only strings that are in docs/COPY.md", () => {
    // ctaLead counts the engine list (X4); filled that way it's the approved sentence.
    const strings = Object.entries(auditCopy).map(([k, v]) =>
      typeof v !== "function"
        ? v
        : k === "ctaLead"
          ? (v as (n: number) => string)(ENGINES.length)
          : (v as (e: string) => string)("{Engine}"),
    );
    expect(strings.length).toBeGreaterThan(15);
    for (const s of strings) expect(copyMd, s).toContain(s);
  });
});
