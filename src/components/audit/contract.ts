// Step 7 (#33): what the run and audit pages read. Answers, citations and metrics are
// data-pipeline's types (#33 metrics); RunResults mirrors backend's result queries until they land.
import type { MetricAnswer, MetricBrand, MetricCitation } from "@/lib/metrics";
export const ENGINES = ["chatgpt", "gemini", "google_aio", "perplexity"] as const;
export type Engine = (typeof ENGINES)[number];
export const ENGINE_LABEL: Record<Engine, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  google_aio: "Google AI Overview",
  perplexity: "Perplexity",
};
// Answers per question per check (PRODUCT.md): ChatGPT 3, Gemini 3, Google AI Overview 3, Perplexity 1.
export const RUNS_PER_ENGINE: Record<Engine, number> = { chatgpt: 3, gemini: 3, google_aio: 3, perplexity: 1 };

export type { Metrics } from "@/lib/metrics";
export type ResultsBrand = MetricBrand & { domain: string | null };
export type ResultsAnswer = MetricAnswer;
export type ResultsCitation = MetricCitation;
export type RunStatus = "queued" | "running" | "partial" | "complete" | "failed";
export type RunResults = {
  run: {
    id: string;
    kind: "audit" | "weekly" | "free_audit";
    status: RunStatus;
    jobs_total: number;
    jobs_ok: number;
    jobs_failed: number;
    started_at: string | null;
    finished_at: string | null;
    business_id: string | null;
  };
  label: string;
  brands: ResultsBrand[];
  answers: ResultsAnswer[];
  citations: ResultsCitation[];
};
