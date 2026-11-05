// Per-user limits on the onboarding lookups (lead, 2026-11-05): readSite fetches other sites and
// Maps lookups are paid DataForSEO calls. Counters live server-side (rate_events, #24).
import type { RateKind } from "@/lib/queries/rate-limits";
const HOUR = 3_600_000;
export const CACHE_MS = 24 * HOUR;

export type LookupKind = RateKind;
// One signed-in user's lookups. take() is take_rate_token, where the limits live
// (read_site 10/h; maps_lookup 5/h and 20/24 h); cached/save are the 24 h result cache.
export type LookupStore = {
  cached: (kind: LookupKind, key: string, maxAgeMs: number) => Promise<unknown>;
  take: (kind: LookupKind) => Promise<boolean>;
  save: (kind: LookupKind, key: string, result: unknown) => Promise<void>;
};

// A cache hit is free. Otherwise every call takes a token, and only results worth reusing are cached.
export async function withLimits<T>(
  store: LookupStore,
  kind: LookupKind,
  key: string,
  run: () => Promise<T>,
  cacheable: (r: T) => boolean,
): Promise<T | "limited"> {
  const hit = await store.cached(kind, key, CACHE_MS);
  if (hit) return hit as T;
  if (!(await store.take(kind))) return "limited";
  const result = await run();
  if (cacheable(result)) await store.save(kind, key, result);
  return result;
}
