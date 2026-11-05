// Contract between the job queue (supabase/migrations 0011, src/lib/queries/run-jobs.ts) and the worker.
import type { EngineId, LocationLevel } from "@/lib/engines/types";

export type TrackedBrand = { id: string; name: string; aliases: string[]; domain: string | null };

// One row from claim_jobs: the job plus everything the worker needs to run and score it.
export type ClaimedJob = {
  job_id: string;
  run_id: string;
  engine: EngineId;
  run_index: 1 | 2 | 3;
  attempt: number;
  question: {
    // null for free-audit jobs, whose question lives only on the job.
    id: string | null;
    text: string;
    location_level: LocationLevel;
    country: string;
    state: string | null;
    city: string | null;
    dfs_location_code: number | null;
  };
  business: TrackedBrand;
  competitors: TrackedBrand[];
};

export type BrandMention = {
  name: string;
  kind: "business" | "competitor";
  mentioned: boolean;
  position: number | null;
};

// finish_job's answer. Failed calls are stored as 'failed' (excluded from denominators), never as "not named".
export type FinishAnswer = {
  status: "ok" | "failed" | "no_overview";
  text: string | null;
  question_text_used?: string;
  location_used: string | null;
  location_supported: "exact" | "fallback_country" | null;
  mentioned: boolean | null;
  first_position: number | null;
  brands: BrandMention[] | null;
  cost_usd: number | null;
  raw: unknown;
  checked_at: string;
  // Stored on the job (run_jobs.last_error) for failed answers only.
  error?: string;
};

// Only URLs the engine returned in this answer, deduped by normalized URL.
export type FinishCitation = {
  url: string;
  domain: string;
  title: string | null;
  position: number;
  category: "reddit" | "youtube" | "social" | "review_directory" | "news_blog" | "other" | null;
};
