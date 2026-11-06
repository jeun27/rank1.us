import type { Metric } from "@/types/metrics";
import { floorPct, metric, TOO_FEW } from "./compute";

// Before/after test vs control (Step 17). Directional only: plain counts and floored points, nothing more.
export const EXPERIMENT_DAYS = 28;
export const EXPERIMENT_LABEL = "Directional";

export type Cell = { named: number; n: number };
export type GroupCounts = { before: Cell; after: Cell };
// From getExperimentData: ok answers of each group's questions, in the runs whose start date falls in each window.
export type ExperimentCounts = { test: GroupCounts; control: GroupCounts };

export type GroupResult = { before: Metric; after: Metric; change: number | null };
export type ExperimentResult = {
  test: GroupResult;
  control: GroupResult;
  difference: number | null;
  // Any of the 4 cells under 10 answers: the UI shows "Too few answers to call yet." instead of numbers.
  tooFew: boolean;
  label: typeof EXPERIMENT_LABEL;
};

// The shared exact floor (as formatPercent), so a change always matches the two shown percents.
// Only called when every cell has n ≥ 10, so never null here.
const pct = (m: Metric) => floorPct(m)!;

export function computeExperiment(counts: ExperimentCounts): ExperimentResult {
  const cells = [counts.test.before, counts.test.after, counts.control.before, counts.control.after];
  const tooFew = cells.some((c) => c.n < TOO_FEW);
  const group = (g: GroupCounts): GroupResult => {
    const before = metric(g.before.named, g.before.n);
    const after = metric(g.after.named, g.after.n);
    return { before, after, change: tooFew ? null : pct(after) - pct(before) };
  };
  const test = group(counts.test);
  const control = group(counts.control);
  const difference = test.change === null || control.change === null ? null : test.change - control.change;
  return { test, control, difference, tooFew, label: EXPERIMENT_LABEL };
}

const DAY_MS = 86_400_000;
const parse = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d)
    throw new RangeError("change_date must be YYYY-MM-DD");
  return t;
};
const addDays = (t: number, days: number) => new Date(t + days * DAY_MS).toISOString().slice(0, 10);

// Inclusive America/Los_Angeles calendar dates, keyed on the run start date (runs.started_at in LA), so a
// run's answers never split across windows, as in History (lead, 2026-11-06):
// before = D−28..D−1, after = D..D+27. Calendar math in UTC, so DST never moves an edge.
export function experimentWindows(changeDate: string) {
  const t = parse(changeDate);
  return {
    before: { from: addDays(t, -EXPERIMENT_DAYS), to: addDays(t, -1) },
    after: { from: changeDate, to: addDays(t, EXPERIMENT_DAYS - 1) },
  };
}

const laDate = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);

export type ExperimentStatus = "running" | "done" | "ended";

// 'running' through D+27 (LA), 'done' from D+28. A user's early end ('ended') always wins.
export function experimentStatus(
  e: { changeDate: string; status: ExperimentStatus },
  now: Date = new Date(),
): ExperimentStatus {
  if (e.status !== "running") return e.status;
  return laDate(now) > experimentWindows(e.changeDate).after.to ? "done" : "running";
}
