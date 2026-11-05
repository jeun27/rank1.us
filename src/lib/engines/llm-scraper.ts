import { dfsLive } from "./dataforseo";
import { DFS_COUNTRY_CODES, EngineError, arr, settle, str, toCitations, type Adapter } from "./shared";

// ChatGPT and Gemini LLM Scraper run at country level only; state/city requests fall back to country.
export function llmScraper(se: "chat_gpt" | "gemini", extra: Record<string, unknown> = {}): Adapter {
  return (req, deps) => {
    const { level, country, dfsLocationCode } = req.location;
    const code = level === "country" && dfsLocationCode ? dfsLocationCode : DFS_COUNTRY_CODES[country.toUpperCase()];
    const loc = {
      locationUsed: country.toUpperCase(),
      locationSupported: level === "country" ? "exact" : "fallback_country",
    } as const;
    return settle(deps, loc, async () => {
      if (!code) throw new EngineError(`no DataForSEO location code for country ${country}`);
      const task = { keyword: req.question, location_code: code, language_code: "en", ...extra };
      const { json, result, cost } = await dfsLive(deps, `/ai_optimization/${se}/llm_scraper/live/advanced`, task);
      return {
        status: "ok",
        text: str(result.markdown) ?? null,
        citations: toCitations(arr(result.sources)),
        costUsd: cost,
        raw: json,
      };
    });
  };
}
