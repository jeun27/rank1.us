import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authCopy } from "@/lib/auth/copy";

const copyMd = readFileSync("docs/COPY.md", "utf8");

describe("auth copy", () => {
  it("uses only strings that are in docs/COPY.md", () => {
    const strings = Object.values(authCopy).map((v) => (typeof v === "function" ? v("{email}") : v));
    for (const s of strings) expect(copyMd, s).toContain(s);
  });
});
