// Step 7 (#33): what the run and audit pages read. Mirrors the types agreed with backend
// (getRunResults / getFreeAuditByToken) and data-pipeline (computeMetrics) until their branches land.
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

export type ResultsBrand = { name: string; kind: "business" | "competitor"; domain: string | null };
export type ResultsAnswer = {
  id: string;
  engine: Engine;
  run_index: number;
  status: "ok" | "failed" | "no_overview";
  question_id: string | null;
  question_text_used: string;
  mentioned: boolean | null;
  first_position: number | null;
  brands: { name: string; position: number }[] | null;
  location_used: string | null;
  location_supported: "exact" | "fallback_country" | null;
  checked_at: string;
};
export type ResultsCitation = {
  answer_id: string;
  url: string;
  domain: string;
  title: string | null;
  category: string | null;
};
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

export type Share = { named: number; n: number; pct: number };
export type Metrics = {
  visibility: Share & { byEngine: Record<Engine, Share> };
  leaderboard: (Share & { name: string; kind: "business" | "competitor"; change: number | null; tooFew: boolean })[];
  sources: { domain: string; category: string | null; count: number }[];
  jobs: { ok: number; failed: number };
  freshness: string | null;
};
