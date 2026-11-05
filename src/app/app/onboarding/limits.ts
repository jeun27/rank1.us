// Per-user limits on the onboarding lookups (lead, 2026-11-05): readSite fetches other sites and
// Maps lookups are paid DataForSEO calls. Counters live server-side in onboarding_lookups.
const HOUR = 3_600_000;
export const LIMITS = {
  read_site: [{ max: 10, windowMs: HOUR }],
  maps: [
    { max: 5, windowMs: HOUR },
    { max: 20, windowMs: 24 * HOUR },
  ],
} as const;
export const CACHE_MS = 24 * HOUR;

export type LookupKind = keyof typeof LIMITS;
export type Limit = { max: number; windowMs: number };
// One signed-in user's lookups: a 24 h result cache and rate tokens (rate_events, backend).
export type LookupStore = {
  cached: (kind: LookupKind, key: string, maxAgeMs: number) => Promise<unknown>;
  // True, and one event recorded, only when every window still has room.
  take: (kind: LookupKind, limits: readonly Limit[]) => Promise<boolean>;
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
  if (!(await store.take(kind, LIMITS[kind]))) return "limited";
  const result = await run();
  if (cacheable(result)) await store.save(kind, key, result);
  return result;
}
