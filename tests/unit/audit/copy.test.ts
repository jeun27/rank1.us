import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditCopy } from "@/components/audit/copy";

const copyMd = readFileSync("docs/COPY.md", "utf8");

describe("audit copy", () => {
  it("uses only strings that are in docs/COPY.md", () => {
    const strings = Object.values(auditCopy).map((v) => (typeof v === "function" ? v("{Engine}") : v));
    expect(strings.length).toBeGreaterThan(15);
    for (const s of strings) expect(copyMd, s).toContain(s);
  });
});
