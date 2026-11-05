// Step 7 (#33): what the run and audit pages read: backend's result queries and data-pipeline's metrics.
import type { RunResults } from "@/lib/queries/results";
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
export type { ResultsAnswer, ResultsBrand, ResultsCitation, RunResults } from "@/lib/queries/results";
export type RunStatus = RunResults["run"]["status"];
