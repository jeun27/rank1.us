import { runEngine as defaultRunEngine } from "@/lib/engines";
import type { EngineAnswer, EngineId, EngineRequest } from "@/lib/engines/types";
import type { Category } from "./categorize";
import { citationDomains, toStoredCitations, type StoredCitation } from "./citations";
import { detectMentions, type BrandMention, type TrackedBrand } from "./mentions";

// One claimed job: the question, its location, and the brands to look for. Aligned to claim_jobs when it lands.
export type ClaimedJob = {
  id: string;
  run_id: string;
  question_id: string;
  engine: EngineId;
  run_index: number;
  question: string;
  location: EngineRequest["location"];
  brands: TrackedBrand[];
};

// The answers row finish_job inserts (without run_id / question_id, which come from the job).
export type StoredAnswer = {
  status: EngineAnswer["status"];
  text: string | null;
  question_text_used: string;
  location_used: string;
  location_supported: EngineAnswer["locationSupported"];
  mentioned: boolean | null;
  first_position: number | null;
  brands: BrandMention[] | null;
  cost_usd: number;
  raw: unknown;
  checked_at: string;
};

export type RunsDb = {
  finishJob(jobId: string, answer: StoredAnswer, citations: StoredCitation[]): Promise<{ error?: string }>;
  manualCategories(domains: string[]): Promise<Record<string, Category>>;
  // Optional: records why finish_job failed on the job row (service role), so stuck jobs are debuggable.
  recordJobError?(jobId: string, message: string): Promise<void>;
};

export type ProcessDeps = { db: RunsDb; runEngine?: typeof defaultRunEngine };
export type ProcessResult = { jobId: string; status: StoredAnswer["status"]; finished: boolean; error?: string };

// Engine answer → stored answer. Mentions only for ok answers; failed and no_overview stay null.
export function toStoredAnswer(job: ClaimedJob, a: EngineAnswer): StoredAnswer {
  const m = a.status === "ok" ? detectMentions(a.text, job.brands) : null;
  return {
    status: a.status,
    text: a.text,
    question_text_used: job.question,
    location_used: a.locationUsed,
    location_supported: a.locationSupported,
    mentioned: m ? m.mentioned : null,
    first_position: m ? m.first_position : null,
    brands: m ? m.brands : null,
    cost_usd: a.costUsd ?? 0,
    raw: a.status === "failed" ? { error: a.error ?? "failed", response: a.raw ?? null } : a.raw,
    checked_at: a.checkedAt,
  };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

// Runs one job end to end. Never throws: an engine error is stored as a failed answer; a finish_job
// error is returned and the job stays running, so claim_jobs re-claims it after its stale-lock timeout.
export async function processJob(job: ClaimedJob, deps: ProcessDeps): Promise<ProcessResult> {
  const run = deps.runEngine ?? defaultRunEngine;
  let answer: EngineAnswer;
  try {
    answer = await run(job.engine, { question: job.question, location: job.location });
  } catch (e) {
    answer = {
      status: "failed",
      text: null,
      citations: [],
      locationUsed: "",
      locationSupported: "exact",
      costUsd: null,
      raw: null,
      checkedAt: new Date().toISOString(),
      error: `worker: ${message(e)}`,
    };
  }
  const stored = toStoredAnswer(job, answer);
  try {
    const cited = answer.status === "ok" ? answer.citations : [];
    const overrides = cited.length ? await deps.db.manualCategories(citationDomains(cited)) : {};
    const { error } = await deps.db.finishJob(job.id, stored, toStoredCitations(cited, overrides));
    if (error) throw new Error(error);
    return { jobId: job.id, status: stored.status, finished: true };
  } catch (e) {
    const error = `finish_job: ${message(e)}`;
    await deps.db.recordJobError?.(job.id, error).catch(() => {});
    return { jobId: job.id, status: stored.status, finished: false, error };
  }
}
