// fix_rules seed: R1-R15 and H1, parsed from docs/SCHEMA.md section 5b so copy stays verbatim.
// A1-A6 are not seeded yet (founder sends them later).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type FixRuleSeed = {
  key: string;
  grp: "restaurant" | "hygiene";
  title: string;
  size: string;
  detection: string;
  data_source: string;
  cadence: "weekly" | "monthly";
  threshold: Record<string, number> | null;
  unverified: string[];
  customer_copy: string;
  why_note: string;
  ai_lever: boolean;
  enabled: boolean;
};

// What each rule depends on that the docs mark UNVERIFIED. Any entry keeps the rule disabled.
// R8 and R13 rely on the same 'site:' operator in a SERP keyword that R6 and R12 mark UNVERIFIED.
const UNVERIFIED: Record<string, string[]> = {
  R1: [
    "DataForSEO Maps SERP item field names UNVERIFIED",
    "DataForSEO Business Data Google My Business info endpoint UNVERIFIED",
  ],
  R2: ["GBP menu field UNVERIFIED"],
  R3: ["GBP photo fields UNVERIFIED", "Threshold UNVERIFIED"],
  R4: ["days without a new review UNVERIFIED", "last review date via DataForSEO Google Reviews UNVERIFIED"],
  R5: ["DataForSEO Google Reviews owner-reply field UNVERIFIED"],
  R6: ["site: in SERP keyword UNVERIFIED", "DataForSEO Business Data Yelp UNVERIFIED"],
  R7: ["DataForSEO Business Data TripAdvisor UNVERIFIED"],
  R8: ["site: in SERP keyword UNVERIFIED (as R6, R12)"],
  R9: ["Facebook/Apple coverage UNVERIFIED"],
  R12: ["outlet domains UNVERIFIED", "site: in SERP keyword UNVERIFIED"],
  R13: ["site: in SERP keyword UNVERIFIED (as R6, R12)"],
  R15: ["special hours field UNVERIFIED"],
};

// Numbers written in the detection text. Unverified thresholds stay out.
const THRESHOLD: Record<string, Record<string, number>> = {
  R4: { rating_below: 4.0 },
  R5: { last_reviews: 50, low_star_max: 3 },
  R11: { max_pages: 20 },
  R12: { serp_depth: 10 },
  R13: { serp_depth: 20, competitors: 3 },
};

const MONTHLY = new Set(["R12", "R13"]);

// Splits a markdown table row on unescaped pipes; "\|" inside a cell is a literal pipe.
const cells = (line: string) =>
  line
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

export function fixRules(schemaMd = readFileSync(join(process.cwd(), "docs", "SCHEMA.md"), "utf8")): FixRuleSeed[] {
  const section = schemaMd.split("# 5b.")[1];
  if (!section) throw new Error("docs/SCHEMA.md has no section 5b");
  return section
    .split("\n")
    .filter((l) => /^\| (R\d+|H1) \|/.test(l))
    .map((line) => {
      const [key, title, size, detection, data_source, customer_copy, why_note] = cells(line);
      const unverified = UNVERIFIED[key] ?? [];
      return {
        key,
        grp: key === "H1" ? "hygiene" : "restaurant",
        title,
        size,
        detection,
        data_source,
        cadence: MONTHLY.has(key) ? "monthly" : "weekly",
        threshold: THRESHOLD[key] ?? null,
        unverified,
        customer_copy,
        why_note,
        ai_lever: key !== "H1",
        enabled: unverified.length === 0,
      };
    });
}
