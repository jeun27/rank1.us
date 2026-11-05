import { chatgpt } from "./chatgpt";
import { gemini } from "./gemini";
import { googleAio } from "./google-aio";
import { perplexity } from "./perplexity";
import type { Adapter } from "./shared";
import type { EngineAnswer, EngineDeps, EngineId, EngineRequest } from "./types";

export type { EngineAnswer, EngineId, EngineRequest } from "./types";

export const ENGINES: Record<EngineId, Adapter> = { chatgpt, gemini, google_aio: googleAio, perplexity };

// Fetch, env and clock are injectable so unit tests run on fixtures. Never throws: errors become status 'failed'.
export function runEngine(engine: EngineId, req: EngineRequest, deps: Partial<EngineDeps> = {}): Promise<EngineAnswer> {
  return ENGINES[engine](req, {
    fetch: deps.fetch ?? fetch,
    env: deps.env ?? process.env,
    now: deps.now ?? (() => new Date()),
    timeoutMs: deps.timeoutMs,
  });
}

export const missingKeys = (env: EngineDeps["env"] = process.env) =>
  (["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "PERPLEXITY_API_KEY"] as const).filter((k) => !env[k]);
