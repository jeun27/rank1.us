import type { DbClient } from "./client";

// Before/after tests vs a control group of questions (Step 17). Self-serve members and the team on
// DFY only: a dfy_client reads nothing and every write is refused. No p-values here or anywhere.

export const EXPERIMENT_DAYS = 28;

export type ExperimentStatus = "running" | "done" | "ended";

export type ExperimentRow = {
  id: string;
  fix_id: string | null;
  name: string;
  change_note: string | null;
  change_url: string | null;
  change_date: string;
  ended_at: string | null;
  status: ExperimentStatus;
  // Question counts per group.
  test: number;
  control: number;
};

// Today's date (YYYY-MM-DD) in America/Los_Angeles.
export function laToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
}

const addDays = (date: string, days: number) => {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

// 'running' until 28 days after change_date (LA), then 'done'; 'ended' when the user ended it early.
export function experimentStatus(e: { status: string | null; change_date: string }, now?: Date): ExperimentStatus {
  if (e.status === "ended") return "ended";
  return laToday(now) >= addDays(e.change_date, EXPERIMENT_DAYS) ? "done" : "running";
}

// The business's experiments, newest change first.
export async function listExperiments(db: DbClient, businessId: string, now?: Date): Promise<ExperimentRow[]> {
  const { data, error } = await db
    .from("experiments")
    .select("id, fix_id, name, change_note, change_url, change_date, ended_at, status, experiment_questions(grp)")
    .eq("business_id", businessId)
    .not("change_date", "is", null)
    .order("change_date", { ascending: false })
    .order("id");
  if (error) throw error;
  return data.map(({ experiment_questions: groups, ...e }) => ({
    ...e,
    change_date: e.change_date!,
    status: experimentStatus({ status: e.status, change_date: e.change_date! }, now),
    test: groups.filter((g) => g.grp === "test").length,
    control: groups.filter((g) => g.grp === "control").length,
  }));
}

export type NewExperiment = {
  businessId: string;
  test: string[];
  // Omitted: the business's other active questions.
  control?: string[];
  fixId?: string | null;
  // Omitted with a fix: the fix title.
  name?: string;
  changeNote?: string | null;
  changeUrl?: string | null;
  // YYYY-MM-DD, not in the future. Omitted: today in LA.
  changeDate?: string;
};

// Errors: 22023 bad input (groups, link, date, name, fix), 42501 not allowed.
export async function createExperiment(db: DbClient, input: NewExperiment): Promise<string> {
  const { data, error } = await db.rpc("create_experiment", {
    p: {
      business_id: input.businessId,
      test: input.test,
      control: input.control ?? null,
      fix_id: input.fixId ?? null,
      name: input.name ?? null,
      change_note: input.changeNote ?? null,
      change_url: input.changeUrl ?? null,
      change_date: input.changeDate ?? null,
    },
  });
  if (error) throw error;
  return data;
}

// False when it wasn't running or the caller can't change it.
export async function endExperiment(db: DbClient, experimentId: string): Promise<boolean> {
  const { data, error } = await db.rpc("end_experiment", { p_experiment_id: experimentId });
  if (error) throw error;
  return data;
}

// False when nothing was deleted (unknown, or not the caller's to delete).
export async function deleteExperiment(db: DbClient, experimentId: string): Promise<boolean> {
  const { data, error } = await db.from("experiments").delete().eq("id", experimentId).select("id");
  if (error) throw error;
  return data.length > 0;
}

export type Cell = { named: number; n: number };
export type Window = { start: string; end: string };
export type ExperimentData = {
  // Dates are YYYY-MM-DD in LA; end is exclusive.
  before: Window;
  after: Window;
  test: { before: Cell; after: Cell };
  control: { before: Cell; after: Cell };
};

// Ok answers per group and window, counted like run_summaries. Null when the caller can't read it.
export async function getExperimentData(db: DbClient, experimentId: string): Promise<ExperimentData | null> {
  const { data, error } = await db.rpc("experiment_data", { p_experiment_id: experimentId });
  if (error) throw error;
  if (data.length === 0) return null;
  const cell = (grp: string, period: string): Cell => {
    const r = data.find((x) => x.grp === grp && x.period === period)!;
    return { named: r.named, n: r.n };
  };
  const window = (period: string): Window => {
    const r = data.find((x) => x.period === period)!;
    return { start: r.starts, end: r.ends };
  };
  return {
    before: window("before"),
    after: window("after"),
    test: { before: cell("test", "before"), after: cell("test", "after") },
    control: { before: cell("control", "before"), after: cell("control", "after") },
  };
}
