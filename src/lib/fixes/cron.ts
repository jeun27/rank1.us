import { unchecked, type FixResult, type RuleKey } from "./types";

const RULES: RuleKey[] = ["R10", "R11", "R14", "H1"];

// The cron route's maxDuration is 300 s; fix checks start only with ≥60 s left (lead, 2026-11-05),
// and only for one run per tick, inside evaluateFixes' 45 s crawl budget.
export const MIN_TIME_LEFT_MS = 60_000;

export type RunToCheck = { runId: string; businessId: string; domain: string | null };

export type FixCheckDeps = {
  next: () => Promise<RunToCheck | null>;
  evaluate: (business: { domain: string | null }) => Promise<FixResult[]>;
  record: (businessId: string, runId: string, results: FixResult[]) => Promise<void>;
  timeLeftMs: () => number;
  log?: (line: string) => void;
};

export type FixCheckSummary = { checked: string | null; skipped?: "time" | "none"; error?: string };

// One closed paid run per tick: evaluate the site rules, then record all 4 (record_fix_results stores
// fix_checks rows, so the run isn't listed again). An evaluate error still records 4 unchecked rows,
// so no run is retried every tick. Never throws; only a failed record leaves the run listed.
export async function checkFixesForOneRun(deps: FixCheckDeps): Promise<FixCheckSummary> {
  const log = deps.log ?? ((l: string) => console.error(l));
  if (deps.timeLeftMs() < MIN_TIME_LEFT_MS) return { checked: null, skipped: "time" };
  try {
    const run = await deps.next();
    if (!run) return { checked: null, skipped: "none" };
    const results = await deps.evaluate({ domain: run.domain }).catch(() => RULES.map((r) => unchecked(r, "error")));
    await deps.record(run.businessId, run.runId, results);
    return { checked: run.runId };
  } catch (e) {
    const code = typeof e === "object" && e && "code" in e ? String(e.code) : "error";
    log(`fix check: failed (${code})`);
    return { checked: null, error: code };
  }
}
