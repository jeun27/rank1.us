import type { Json } from "@/types/db";
import type { DbClient } from "./client";
import type { RateKind } from "./rate-limits";

// lookup_cache is service-role only (RLS on, no policies): pass the service client.

// The cached result for this user, kind and key if it was stored within maxAgeSeconds.
export async function getCachedLookup(
  db: DbClient,
  userId: string,
  kind: RateKind,
  key: string,
  maxAgeSeconds: number,
): Promise<Json | null> {
  const since = new Date(Date.now() - maxAgeSeconds * 1000).toISOString();
  const { data, error } = await db
    .from("lookup_cache")
    .select("result")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("key", key)
    .gt("created_at", since)
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

// Stores (or replaces) the result for this user, kind and key, restarting its age.
export async function putCachedLookup(
  db: DbClient,
  row: { user_id: string; kind: RateKind; key: string; result: Json },
): Promise<void> {
  const { error } = await db
    .from("lookup_cache")
    .upsert({ ...row, created_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
  if (error) throw error;
}
