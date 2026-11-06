import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatPercent } from "@/components/ui/StatNumber";
import {
  computeExperiment,
  EXPERIMENT_DAYS,
  experimentStatus,
  experimentWindows,
  type ExperimentCounts,
} from "@/lib/metrics/experiment";

const cell = (named: number, n: number) => ({ named, n });
const counts = (
  test: [number, number, number, number],
  control: [number, number, number, number],
): ExperimentCounts => ({
  test: { before: cell(test[0], test[1]), after: cell(test[2], test[3]) },
  control: { before: cell(control[0], control[1]), after: cell(control[2], control[3]) },
});

describe("computeExperiment", () => {
  it("each group gets before/after Metrics with n, the change in whole points, and the difference", () => {
    const r = computeExperiment(counts([10, 40, 20, 40], [12, 40, 14, 40]));
    expect(r.test.before).toEqual({ value: 0.25, numerator: 10, denominator: 40 });
    expect(r.test.after).toEqual({ value: 0.5, numerator: 20, denominator: 40 });
    expect(r.test.change).toBe(25); // 50% − 25%
    expect(r.control.change).toBe(5); // 35% − 30%
    expect(r.difference).toBe(20); // test − control
    expect(r.tooFew).toBe(false);
    expect(r.label).toBe("Directional");
  });

  it("floors each percent before subtracting, so the change matches the two shown percents", () => {
    // 33.9% → 33 and 66.6% → 66.
    const r = computeExperiment(counts([339, 1000, 666, 1000], [10, 20, 10, 20]));
    expect(r.test.change).toBe(66 - 33);
    // 19.9% → 19 and 20.0% → 20: floored change 1, not 0.1 rounded to 0.
    const s = computeExperiment(counts([199, 1000, 200, 1000], [10, 20, 10, 20]));
    expect(s.test.change).toBe(1);
  });

  it("uses exact integer flooring (29 of 100 is 29%, matching formatPercent, never 28)", () => {
    const r = computeExperiment(counts([29, 100, 57, 100], [10, 20, 10, 20]));
    expect(formatPercent(r.test.before)).toBe("29%");
    expect(formatPercent(r.test.after)).toBe("57%");
    expect(r.test.change).toBe(28);
  });

  it("changes and the difference can be negative or zero", () => {
    const r = computeExperiment(counts([30, 50, 20, 50], [10, 50, 25, 50]));
    expect(r.test.change).toBe(-20);
    expect(r.control.change).toBe(30);
    expect(r.difference).toBe(-50);
    const z = computeExperiment(counts([5, 20, 5, 20], [5, 20, 5, 20]));
    expect([z.test.change, z.control.change, z.difference]).toEqual([0, 0, 0]);
  });

  it("n = 10 in every cell is enough; n = 9 in any one cell is tooFew, with no change or difference", () => {
    expect(computeExperiment(counts([1, 10, 2, 10], [3, 10, 4, 10])).tooFew).toBe(false);
    const cases: [number, number, number, number][][] = [
      [
        [1, 9, 2, 10],
        [3, 10, 4, 10],
      ],
      [
        [1, 10, 2, 9],
        [3, 10, 4, 10],
      ],
      [
        [1, 10, 2, 10],
        [3, 9, 4, 10],
      ],
      [
        [1, 10, 2, 10],
        [3, 10, 4, 9],
      ],
    ];
    for (const [t, c] of cases) {
      const r = computeExperiment(counts(t, c));
      expect(r.tooFew).toBe(true);
      expect([r.test.change, r.control.change, r.difference]).toEqual([null, null, null]);
      // n stays available for the partial state.
      expect(r.test.before.denominator).toBe(t[1]);
      expect(r.label).toBe("Directional");
    }
  });

  it("no answers at all (0 of 0) is tooFew with null values, never NaN", () => {
    const r = computeExperiment(counts([0, 0, 0, 0], [0, 0, 0, 0]));
    expect(r.tooFew).toBe(true);
    expect(r.test.before).toEqual({ value: null, numerator: 0, denominator: 0 });
    expect(JSON.stringify(r)).not.toContain("NaN");
  });

  it("carries no significance statistics: no p-value, significance or confidence in the output or the source", () => {
    const out = JSON.stringify(computeExperiment(counts([10, 40, 20, 40], [12, 40, 14, 40])));
    const src = readFileSync(join(process.cwd(), "src/lib/metrics/experiment.ts"), "utf8");
    for (const text of [out, src]) expect(text).not.toMatch(/p[-_ ]?value|signific|confidence|z[-_ ]?score/i);
  });
});

describe("experimentWindows (inclusive America/Los_Angeles dates)", () => {
  it("before = D−28..D−1 and after = D..D+27, 28 days each", () => {
    expect(EXPERIMENT_DAYS).toBe(28);
    expect(experimentWindows("2026-11-16")).toEqual({
      before: { from: "2026-10-19", to: "2026-11-15" },
      after: { from: "2026-11-16", to: "2026-12-13" },
    });
  });

  it("crosses months, years and leap days by calendar date", () => {
    expect(experimentWindows("2027-01-10")).toEqual({
      before: { from: "2026-12-13", to: "2027-01-09" },
      after: { from: "2027-01-10", to: "2027-02-06" },
    });
    expect(experimentWindows("2028-03-01")).toEqual({
      before: { from: "2028-02-02", to: "2028-02-29" },
      after: { from: "2028-03-01", to: "2028-03-28" },
    });
  });

  it("DST changes don't move the edges (2026-11-01 PST, 2027-03-14 PDT)", () => {
    expect(experimentWindows("2026-11-01").before).toEqual({ from: "2026-10-04", to: "2026-10-31" });
    expect(experimentWindows("2027-03-14").after).toEqual({ from: "2027-03-14", to: "2027-04-10" });
  });

  it("rejects a malformed date", () => {
    for (const bad of ["2026-11-31", "2026-13-01", "11/16/2026", ""]) expect(() => experimentWindows(bad)).toThrow();
  });
});

describe("experimentStatus", () => {
  const D = "2026-11-16";
  // LA times: 2026-12-13 23:59 PST is 2026-12-14T07:59Z; 2026-12-14 00:00 PST is 08:00Z.
  it("running through D+27 (LA), done from D+28", () => {
    expect(experimentStatus({ changeDate: D, status: "running" }, new Date("2026-11-16T08:00:00Z"))).toBe("running");
    expect(experimentStatus({ changeDate: D, status: "running" }, new Date("2026-12-14T07:59:00Z"))).toBe("running");
    expect(experimentStatus({ changeDate: D, status: "running" }, new Date("2026-12-14T08:00:00Z"))).toBe("done");
  });

  it("'ended' always wins, and a stored 'done' stays done", () => {
    expect(experimentStatus({ changeDate: D, status: "ended" }, new Date("2026-11-20T12:00:00Z"))).toBe("ended");
    expect(experimentStatus({ changeDate: D, status: "ended" }, new Date("2027-01-20T12:00:00Z"))).toBe("ended");
    expect(experimentStatus({ changeDate: D, status: "done" }, new Date("2026-11-20T12:00:00Z"))).toBe("done");
  });
});
