import { describe, expect, it } from "vitest";
import { byPillarThenSize, PILLAR_ORDER, type OpenFix } from "@/lib/queries/fixes";

const f = (rule_key: string, pillar: OpenFix["pillar"], size: OpenFix["size"]): OpenFix => ({
  id: rule_key,
  rule_key,
  size,
  title: rule_key,
  detail: null,
  affected_answers: null,
  status: "todo",
  pillar,
});

// X1a: the Dashboard's next fix and the Fix list share one order: blockers (P5) first, P0 last, then size.
describe("fix order", () => {
  it("is pillar P5, P3, P2, P1, P4, P6, P0", () => {
    expect(PILLAR_ORDER).toEqual(["p5", "p3", "p2", "p1", "p4", "p6", "p0"]);
  });

  it("puts a larger P5 fix before a smaller P3 one, then sorts by size and rule key", () => {
    const sorted = [
      f("R1", "p3", "S"),
      f("R11", "p2", "S"),
      f("R10", "p5", "M-L"),
      f("R14", "p5", "S"),
      f("A1", "p0", "S"),
    ]
      .sort(byPillarThenSize)
      .map((x) => x.rule_key);
    expect(sorted).toEqual(["R14", "R10", "R1", "R11", "A1"]);
  });
});
