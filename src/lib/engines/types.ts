// Engine adapter contract. Adapters only fetch answers: no LLM calls for detection.
export const ENGINE_IDS = ["chatgpt", "gemini", "google_aio", "perplexity"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

export type LocationLevel = "country" | "state" | "city";

export type EngineRequest = {
  question: string;
  location: { level: LocationLevel; country: string; state?: string; city?: string; dfsLocationCode?: number };
};

export type EngineCitation = { url: string; domain: string; title?: string; position: number };

export type EngineAnswer = {
  status: "ok" | "failed" | "no_overview";
  text: string | null;
  // Only links the engine returned in this answer, in its order.
  citations: EngineCitation[];
  locationUsed: string;
  locationSupported: "exact" | "fallback_country";
  costUsd: number | null;
  raw: unknown;
  checkedAt: string;
  error?: string;
};

// Reads DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, PERPLEXITY_API_KEY and PERPLEXITY_MODEL.
export type EngineEnv = Record<string, string | undefined>;

export type EngineDeps = {
  fetch: typeof fetch;
  env: EngineEnv;
  now: () => Date;
  timeoutMs?: number;
};
