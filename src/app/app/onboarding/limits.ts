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
// One signed-in user's lookups.
export type LookupStore = {
  count: (kind: LookupKind, since: Date) => Promise<number>;
  cached: (kind: LookupKind, key: string, since: Date) => Promise<unknown>;
  record: (kind: LookupKind, key: string, result: unknown) => Promise<void>;
};

// A cache hit is free. Otherwise every call counts, and only results worth reusing are cached.
export async function withLimits<T>(
  store: LookupStore,
  kind: LookupKind,
  key: string,
  now: Date,
  run: () => Promise<T>,
  cacheable: (r: T) => boolean,
): Promise<T | "limited"> {
  const hit = await store.cached(kind, key, new Date(now.getTime() - CACHE_MS));
  if (hit) return hit as T;
  for (const { max, windowMs } of LIMITS[kind])
    if ((await store.count(kind, new Date(now.getTime() - windowMs))) >= max) return "limited";
  const result = await run();
  await store.record(kind, key, cacheable(result) ? result : null);
  return result;
}
