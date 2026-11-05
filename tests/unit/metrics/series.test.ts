import { describe, expect, it } from "vitest";
import { seriesFromSummaries, type SeriesSummary } from "@/lib/metrics";

const s = (i: number, p: Partial<SeriesSummary> = {}): SeriesSummary => ({
  id: `run-${i}`,
  kind: "weekly",
  status: "complete",
  started_at: `2026-10-${String(i).padStart(2, "0")}T14:00:00.000Z`,
  finished_at: `2026-10-${String(i).padStart(2, "0")}T14:40:00.000Z`,
  visibility: { named: i, n: 20 },
  ...p,
});

describe("seriesFromSummaries", () => {
  it("the latest 8 complete/partial runs, oldest → newest, Metric-shaped", () => {
    const rows = Array.from({ length: 10 }, (_, i) => s(i + 1)).reverse();
    const { points, visible } = seriesFromSummaries(rows);
    expect(visible).toBe(true);
    expect(points.map((p) => p.runId)).toEqual([
      "run-3",
      "run-4",
      "run-5",
      "run-6",
      "run-7",
      "run-8",
      "run-9",
      "run-10",
    ]);
    expect(points[0]).toEqual({
      runId: "run-3",
      at: "2026-10-03T14:40:00.000Z",
      metric: { value: 3 / 20, numerator: 3, denominator: 20 },
    });
  });

  it("skips failed, queued and running runs and free audits", () => {
    const { points } = seriesFromSummaries([
      s(5, { status: "failed" }),
      s(4, { status: "running", finished_at: null }),
      s(3, { kind: "free_audit" }),
      s(2, { status: "partial" }),
      s(1, { kind: "audit" }),
    ]);
    expect(points.map((p) => p.runId)).toEqual(["run-1", "run-2"]);
  });

  it("hidden with fewer than 2 points", () => {
    expect(seriesFromSummaries([s(1)])).toEqual({
      points: [expect.objectContaining({ runId: "run-1" })],
      visible: false,
    });
    expect(seriesFromSummaries([])).toEqual({ points: [], visible: false });
  });

  it("n = 0 → value null, never 0%", () => {
    const { points } = seriesFromSummaries([s(2, { visibility: { named: 0, n: 0 } }), s(1)]);
    expect(points[1].metric).toEqual({ value: null, numerator: 0, denominator: 0 });
  });

  it("orders by finish time even when input order is off, falling back to start time", () => {
    const { points } = seriesFromSummaries([s(1), s(3), s(2, { finished_at: null })]);
    expect(points.map((p) => p.runId)).toEqual(["run-1", "run-2", "run-3"]);
  });
});
