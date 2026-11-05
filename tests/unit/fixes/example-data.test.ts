import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exampleFixes, exampleTidyUps, exampleUnchecked } from "@/components/fixes/example-data";
import { COPY } from "@/lib/fixes/types";
import { FIX_SIZES, type FixSize } from "@/lib/queries/fixes";

// QA #58: the /dev/app fixes gallery shows what production shows: fix_rules titles, the §5b detail
// templates filled, smallest effort first, and no answer count for site rules.
const seed = readFileSync("supabase/seed.sql", "utf8");
const rule = (key: string) => {
  const m = seed.match(new RegExp(`\\('${key}', '[^']+', '((?:[^']|'')+)', '([^']+)'`));
  if (!m) throw new Error(`no seed rule ${key}`);
  return { title: m[1].replace(/''/g, "'"), size: m[2] as FixSize };
};
const asTemplate = (t: string) => new RegExp(`^${t.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, ".+")}$`);

describe("fix gallery Example data", () => {
  it("uses the fix_rules titles and the filled customer copy", () => {
    for (const f of [...exampleFixes, ...exampleTidyUps]) {
      expect(f.title).toBe(rule(f.rule_key).title);
      expect(f.detail).toMatch(asTemplate(COPY[f.rule_key as keyof typeof COPY]));
      expect(f.detail).not.toMatch(/\{/);
      expect(f.affected_answers).toBeNull();
    }
    for (const u of exampleUnchecked) expect(u.title).toBe(rule(u.rule_key).title);
  });

  it("lists ranked fixes smallest effort first, as listFixes does", () => {
    const sizes = exampleFixes.map((f) => FIX_SIZES.indexOf(rule(f.rule_key).size));
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });
});
