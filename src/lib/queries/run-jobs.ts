import type { Json } from "@/types/db";
import type { ClaimedJob, FinishAnswer, FinishCitation } from "@/lib/runs/types";
import type { DbClient } from "./client";

export type RunKind = "audit" | "weekly";

// Starts a run. Members: audit only, one per business per 24 h; the service role: audit or weekly.
// Errors: 42501 not allowed, P0402 subscription required, P0409 run in progress, P0429 audit limit,
// 22023 bad kind, archived business or no active questions. Returns the run id.
export async function createRun(db: DbClient, businessId: string, kind: RunKind): Promise<string> {
  const { data, error } = await db.rpc("create_run", { p_business_id: businessId, p_kind: kind });
  if (error) throw error;
  return data;
}

// Service client only. Claims up to `limit` jobs for the worker.
export async function claimJobs(db: DbClient, limit: number): Promise<ClaimedJob[]> {
  const { data, error } = await db.rpc("claim_jobs", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as unknown as ClaimedJob[];
}

// Service client only. Stores the answer and citations and closes the job; a repeat call is a no-op.
export async function finishJob(
  db: DbClient,
  jobId: string,
  answer: FinishAnswer,
  citations: FinishCitation[],
): Promise<void> {
  const { error } = await db.rpc("finish_job", {
    p_job_id: jobId,
    p_answer: answer as unknown as Json,
    p_citations: citations as unknown as Json,
  });
  if (error) throw error;
}

// Service client only. Records an error on a job without finishing it.
export async function recordJobError(db: DbClient, jobId: string, message: string): Promise<void> {
  const { error } = await db.rpc("job_error", { p_job_id: jobId, p_error: message });
  if (error) throw error;
}
