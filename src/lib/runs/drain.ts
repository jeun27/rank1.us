import type { ProcessResult } from "./process-job";
import type { ClaimedJob } from "./types";

export const CHUNK = 5;
export const DEFAULT_BATCH = 20;
// Live engine calls take up to ~130 s, so stop starting chunks well before the function limit.
export const DEFAULT_BUDGET_MS = 150_000;

// Exact `Bearer ${CRON_SECRET}`; an unset or blank secret rejects everything (Vercel Cron docs).
export function cronAuthorized(header: string | null, secret = process.env.CRON_SECRET): boolean {
  return !!secret?.trim() && header === `Bearer ${secret}`;
}

export const batchSize = (raw = process.env.RUN_JOBS_BATCH) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100) : DEFAULT_BATCH;
};

export type DrainDeps = {
  claim: (limit: number) => Promise<ClaimedJob[]>;
  process: (job: ClaimedJob) => Promise<ProcessResult>;
  now?: () => number;
  batch?: number;
  budgetMs?: number;
};

export type DrainSummary = {
  claimed: number;
  finished: number;
  unfinished: number;
  stopped: "empty" | "batch" | "budget";
};

// Claims jobs in chunks of 5 and processes each chunk in parallel, until the batch is used up, the
// queue is empty, or the time budget is spent. Only claims what it will process right away.
export async function drainJobs(deps: DrainDeps): Promise<DrainSummary> {
  const now = deps.now ?? Date.now;
  const batch = deps.batch ?? DEFAULT_BATCH;
  const budget = deps.budgetMs ?? DEFAULT_BUDGET_MS;
  const started = now();
  const s: DrainSummary = { claimed: 0, finished: 0, unfinished: 0, stopped: "batch" };
  while (s.claimed < batch) {
    if (now() - started >= budget) return { ...s, stopped: "budget" };
    const jobs = await deps.claim(Math.min(CHUNK, batch - s.claimed));
    if (jobs.length === 0) return { ...s, stopped: "empty" };
    s.claimed += jobs.length;
    const results = await Promise.all(jobs.map((j) => deps.process(j)));
    const finished = results.filter((r) => r.finished).length;
    s.finished += finished;
    s.unfinished += results.length - finished;
  }
  return s;
}
