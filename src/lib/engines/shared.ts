import type { EngineAnswer, EngineCitation, EngineDeps, EngineRequest } from "./types";

export const COUNTRY_NAMES: Record<string, string> = { US: "United States" };
// DataForSEO location_code for a country, from the docs examples (2840 = United States).
export const DFS_COUNTRY_CODES: Record<string, number> = { US: 2840 };

export const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

// Unknown codes return undefined, so the caller falls back instead of sending a guess.
export const stateName = (state?: string) => (state ? US_STATES[state.toUpperCase()] : undefined);

// Base-URL overrides exist only for local e2e. Ignored on Vercel production, and only a loopback host is
// ever accepted, so engine keys can't be sent anywhere but the official hosts or this machine.
export function apiBase(env: Record<string, string | undefined>, override: string | undefined, official: string) {
  if (!override || env.VERCEL_ENV === "production") return official;
  try {
    const host = new URL(override).hostname;
    return ["127.0.0.1", "localhost", "[::1]"].includes(host) ? override.replace(/\/$/, "") : official;
  } catch {
    return official;
  }
}

export class EngineError extends Error {
  constructor(
    message: string,
    readonly raw: unknown = null,
    readonly costUsd: number | null = null,
  ) {
    super(message);
  }
}

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Keeps every returned link in order; skips only entries with no url.
export function toCitations(links: unknown[]): EngineCitation[] {
  return links
    .filter(isObj)
    .filter((l) => str(l.url))
    .map((l, i) => {
      const url = l.url as string;
      const title = str(l.title);
      return { url, domain: str(l.domain) ?? domainOf(url), ...(title ? { title } : {}), position: i + 1 };
    });
}

// POSTs JSON with a timeout. Returns parsed JSON; throws EngineError on HTTP error, timeout or bad JSON.
export async function postJson(
  deps: EngineDeps,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
) {
  const ms = deps.timeoutMs ?? timeoutMs;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  let res: Response;
  try {
    res = await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new EngineError(ctrl.signal.aborted ? `timeout after ${ms} ms` : `network error: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (res.ok) throw new EngineError("response is not JSON", text.slice(0, 2000));
  }
  if (!res.ok) throw new EngineError(`HTTP ${res.status}`, json ?? text.slice(0, 2000));
  return json;
}

export type Located = { locationUsed: string; locationSupported: EngineAnswer["locationSupported"] };

// Runs `call` and turns any EngineError (or unexpected error) into a failed answer. Never throws.
export async function settle(
  deps: EngineDeps,
  loc: Located,
  call: () => Promise<Omit<EngineAnswer, "checkedAt" | keyof Located>>,
): Promise<EngineAnswer> {
  const checkedAt = deps.now().toISOString();
  try {
    return { ...(await call()), ...loc, checkedAt };
  } catch (e) {
    const err = e instanceof EngineError ? e : new EngineError(`unexpected: ${(e as Error)?.message ?? String(e)}`);
    return {
      status: "failed",
      text: null,
      citations: [],
      ...loc,
      costUsd: err.costUsd,
      raw: err.raw,
      checkedAt,
      error: err.message,
    };
  }
}

export type Adapter = (req: EngineRequest, deps: EngineDeps) => Promise<EngineAnswer>;
