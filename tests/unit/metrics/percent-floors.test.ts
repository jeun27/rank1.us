import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatPercent } from "@/components/ui/StatNumber";
import { progressPercent } from "@/components/ui/ProgressBar";
import { floorPct, metric } from "@/lib/metrics";
import { pointsChange } from "@/lib/workspace/context";

// Floating point: 0.29 * 100 = 28.999…, so Math.floor(value * 100) shows 29 of 100 as 28%.
// Every percent floors from the integers: Math.floor(numerator * 100 / denominator).
const KNOWN_BAD: [number, number, number][] = [
  [29, 100, 29],
  [57, 100, 57],
  [7, 25, 28],
  [58, 200, 29],
];

describe("exact percent floors", () => {
  it.each(KNOWN_BAD)("floorPct(%i/%i) = %i", (n, d, want) => {
    expect(floorPct(metric(n, d))).toBe(want);
  });

  it.each(KNOWN_BAD)("formatPercent(%i/%i) = %i%", (n, d, want) => {
    expect(formatPercent(metric(n, d))).toBe(`${want}%`);
  });

  it.each(KNOWN_BAD)("progressPercent(%i, %i) = %i", (n, d, want) => {
    expect(progressPercent(n, d)).toBe(want);
  });

  it("still floors (never rounds up) and is null with no answers", () => {
    expect(floorPct(metric(2, 3))).toBe(66);
    expect(floorPct(metric(55, 160))).toBe(34);
    expect(floorPct(metric(0, 0))).toBeNull();
    expect(formatPercent(metric(0, 0))).toBe("–");
    expect(progressPercent(0, 0)).toBeNull();
    expect(progressPercent(150, 100)).toBe(100);
  });

  it('"+N pts" is the difference of the two shown percents', () => {
    expect(pointsChange(metric(57, 100), metric(29, 100))).toBe("+28 pts");
    expect(pointsChange(metric(58, 200), metric(57, 100))).toBe("-28 pts");
  });

  it("one shared helper: no other code floors a ratio times 100", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk(join(process.cwd(), "src"));
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /Math\.floor\([^;]*\*\s*100/.test(src) && !f.endsWith(join("lib", "metrics", "compute.ts"));
    });
    expect(offenders).toEqual([]);
  });
});
