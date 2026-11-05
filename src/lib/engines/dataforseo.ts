import { EngineError, arr, isObj, num, postJson, str } from "./shared";
import type { EngineDeps } from "./types";

export const DFS_BASE = "https://api.dataforseo.com/v3";
// Live tasks take up to ~120 s (INTEGRATIONS.md).
export const DFS_TIMEOUT_MS = 130_000;
const OK = 20000;

// One live task. Returns the task's first result; throws EngineError unless both status codes are 20000.
export async function dfsLive(deps: EngineDeps, path: string, task: Record<string, unknown>) {
  const { DATAFORSEO_LOGIN: login, DATAFORSEO_PASSWORD: password } = deps.env;
  if (!login || !password) throw new EngineError("missing keys: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD");
  const auth = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  const json = await postJson(
    deps,
    `${deps.env.DATAFORSEO_API_URL || DFS_BASE}${path}`,
    { Authorization: auth },
    [task],
    DFS_TIMEOUT_MS,
  );
  if (!isObj(json)) throw new EngineError("response is not an object", json);
  const t = arr(json.tasks)[0];
  const cost = isObj(t) ? num(t.cost) : null;
  if (json.status_code !== OK)
    throw new EngineError(`DataForSEO ${json.status_code}: ${str(json.status_message) ?? ""}`.trim(), json, cost);
  if (!isObj(t)) throw new EngineError("no task in response", json);
  if (t.status_code !== OK)
    throw new EngineError(`DataForSEO task ${t.status_code}: ${str(t.status_message) ?? ""}`.trim(), json, cost);
  const result = arr(t.result)[0];
  if (!isObj(result)) throw new EngineError("task has no result", json, cost);
  return { json, result, cost };
}
