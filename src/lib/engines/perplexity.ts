import {
  COUNTRY_NAMES,
  EngineError,
  arr,
  isObj,
  num,
  postJson,
  settle,
  stateName,
  str,
  toCitations,
  type Adapter,
} from "./shared";

export const PERPLEXITY_URL = "https://api.perplexity.ai/v1/agent";
// TODO(Jeun): confirm. "Perplexity's grounded search model" in docs.perplexity.ai/docs/agent-api/models.md.
export const PERPLEXITY_DEFAULT_MODEL = "perplexity/sonar";
// UNVERIFIED: the docs give no timeout; this is our own limit.
export const PERPLEXITY_TIMEOUT_MS = 60_000;

export const perplexity: Adapter = (req, deps) => {
  const { level, country, state, city } = req.location;
  const region = level === "country" ? undefined : stateName(state);
  // City is sent only with its region, so the level sent is always complete.
  const town = level === "city" && region ? city : undefined;
  const sent = town ? "city" : region ? "state" : "country";
  const user_location = {
    country: country.toUpperCase(),
    ...(region ? { region } : {}),
    ...(town ? { city: town } : {}),
  };
  const used = [town, region, COUNTRY_NAMES[user_location.country] ?? user_location.country].filter(Boolean).join(", ");
  return settle(
    deps,
    { locationUsed: used, locationSupported: sent === level ? "exact" : "fallback_country" },
    async () => {
      const key = deps.env.PERPLEXITY_API_KEY;
      if (!key) throw new EngineError("missing keys: PERPLEXITY_API_KEY");
      const body = {
        model: deps.env.PERPLEXITY_MODEL || PERPLEXITY_DEFAULT_MODEL,
        input: req.question,
        tools: [{ type: "web_search", user_location }],
      };
      const json = await postJson(
        deps,
        PERPLEXITY_URL,
        { Authorization: `Bearer ${key}` },
        body,
        PERPLEXITY_TIMEOUT_MS,
      );
      if (!isObj(json)) throw new EngineError("response is not an object", json);
      const cost = isObj(json.usage) && isObj(json.usage.cost) ? num(json.usage.cost.total_cost) : null;
      if (json.error)
        throw new EngineError(`Perplexity error: ${JSON.stringify(json.error).slice(0, 300)}`, json, cost);
      if (json.status !== undefined && json.status !== "completed")
        throw new EngineError(`Perplexity status ${String(json.status)}`, json, cost);
      const output = arr(json.output).filter(isObj);
      const text = output
        .filter((o) => o.type === "message")
        .flatMap((o) => arr(o.content).filter(isObj))
        .filter((c) => c.type === "output_text")
        .map((c) => str(c.text))
        .filter(Boolean)
        .join("\n\n");
      const links = output.filter((o) => o.type === "search_results").flatMap((o) => arr(o.results));
      return { status: "ok", text: text || null, citations: toCitations(links), costUsd: cost, raw: json };
    },
  );
};
