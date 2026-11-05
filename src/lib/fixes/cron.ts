import type { FixResult } from "./types";

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

// One closed paid run per tick: evaluate the site rules, then record them (record_fix_results marks
// the run checked). Never throws; a failed record leaves the run listed for the next tick.
export async function checkFixesForOneRun(deps: FixCheckDeps): Promise<FixCheckSummary> {
  const log = deps.log ?? ((l: string) => console.error(l));
  if (deps.timeLeftMs() < MIN_TIME_LEFT_MS) return { checked: null, skipped: "time" };
  try {
    const run = await deps.next();
    if (!run) return { checked: null, skipped: "none" };
    await deps.record(run.businessId, run.runId, await deps.evaluate({ domain: run.domain }));
    return { checked: run.runId };
  } catch (e) {
    const code = typeof e === "object" && e && "code" in e ? String(e.code) : "error";
    log(`fix check: failed (${code})`);
    return { checked: null, error: code };
  }
}
