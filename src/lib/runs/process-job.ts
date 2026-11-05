import { runEngine as defaultRunEngine } from "@/lib/engines";
import type { EngineAnswer } from "@/lib/engines/types";
import { finishJob, recordJobError } from "@/lib/queries/run-jobs";
import { createServiceClient } from "@/lib/supabase/service";
import type { Category } from "./categorize";
import { citationDomains, toStoredCitations } from "./citations";
import { detectMentions, jobBrands } from "./mentions";
import type { ClaimedJob, FinishAnswer, FinishCitation } from "./types";

export type RunsDb = {
  finishJob(jobId: string, answer: FinishAnswer, citations: FinishCitation[]): Promise<void>;
  recordJobError(jobId: string, message: string): Promise<void>;
  manualCategories(domains: string[]): Promise<Record<string, Category>>;
};

export type ProcessDeps = { db?: RunsDb; runEngine?: typeof defaultRunEngine };
export type ProcessResult = { jobId: string; status: FinishAnswer["status"]; finished: boolean; error?: string };

// The service-role adapter over backend's wrappers (src/lib/queries/run-jobs.ts) and domain_categories.
export function serviceRunsDb(db = createServiceClient()): RunsDb {
  return {
    finishJob: (id, answer, citations) => finishJob(db, id, answer, citations),
    recordJobError: (id, message) => recordJobError(db, id, message),
    async manualCategories(domains) {
      if (!domains.length) return {};
      const { data, error } = await db.from("domain_categories").select("domain, category").eq("source", "manual");
      if (error) throw error;
      const want = new Set(domains);
      const rows = (data ?? []).map((r) => ({
        domain: r.domain.toLowerCase().replace(/^www\./, ""),
        category: r.category,
      }));
      return Object.fromEntries(
        rows
          .filter((r) => [...want].some((d) => d === r.domain || d.endsWith(`.${r.domain}`)))
          .map((r) => [r.domain, r.category as Category]),
      );
    },
  };
}

// Engine answer → finish_job answer. Mentions only for ok answers; failed and no_overview stay null.
export function toFinishAnswer(job: ClaimedJob, a: EngineAnswer): FinishAnswer {
  const m = a.status === "ok" ? detectMentions(a.text, jobBrands(job)) : null;
  return {
    status: a.status,
    text: a.text,
    question_text_used: job.question.text,
    location_used: a.locationUsed || null,
    location_supported: a.locationSupported,
    mentioned: m ? m.mentioned : null,
    first_position: m ? m.first_position : null,
    brands: m ? m.brands : null,
    cost_usd: a.costUsd,
    raw: a.raw ?? null,
    checked_at: a.checkedAt,
    ...(a.status === "failed" ? { error: (a.error ?? "failed").slice(0, 1000) } : {}),
  };
}

const message = (e: unknown) =>
  (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : String(e)).slice(
    0,
    500,
  );

// Runs one claimed job end to end. Never throws: an engine error is stored as a failed answer; a
// finish_job error is recorded on the job, which stays running until claim_jobs re-claims it.
export async function processJob(job: ClaimedJob, deps: ProcessDeps = {}): Promise<ProcessResult> {
  const run = deps.runEngine ?? defaultRunEngine;
  const q = job.question;
  let answer: EngineAnswer;
  try {
    answer = await run(job.engine, {
      question: q.text,
      location: {
        level: q.location_level,
        country: q.country,
        ...(q.state ? { state: q.state } : {}),
        ...(q.city ? { city: q.city } : {}),
        ...(q.dfs_location_code ? { dfsLocationCode: q.dfs_location_code } : {}),
      },
    });
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
  const finish = toFinishAnswer(job, answer);
  let db: RunsDb | undefined;
  try {
    db = deps.db ?? serviceRunsDb();
    const cited = answer.status === "ok" ? answer.citations : [];
    const overrides = cited.length ? await db.manualCategories(citationDomains(cited)) : {};
    await db.finishJob(job.job_id, finish, toStoredCitations(cited, overrides));
    return { jobId: job.job_id, status: finish.status, finished: true };
  } catch (e) {
    const error = `finish_job: ${message(e)}`;
    try {
      await db?.recordJobError(job.job_id, error);
    } catch {
      // Best effort: the stale lock still gets the job re-claimed.
    }
    return { jobId: job.job_id, status: finish.status, finished: false, error };
  }
}
