import type { Json } from "@/types/db";
import type { DbClient } from "./client";
import type { RateKind } from "./rate-limits";

// onboarding_lookups is service-role only (RLS on, no policies): pass the service client.
// Store only the normalized action result, never a raw vendor response or error.

// The cached result for this user, kind and key if it was stored after `since`, else null.
export async function findCachedLookup(
  db: DbClient,
  userId: string,
  kind: RateKind,
  key: string,
  since: Date,
): Promise<Json | null> {
  const { data, error } = await db
    .from("onboarding_lookups")
    .select("result")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("key", key)
    .gt("created_at", since.toISOString())
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

// Stores (or replaces) the result for this user, kind and key, restarting its age.
export async function recordLookup(
  db: DbClient,
  row: { user_id: string; kind: RateKind; key: string; result: Json },
): Promise<void> {
  const { error } = await db
    .from("onboarding_lookups")
    .upsert({ ...row, created_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
  if (error) throw error;
}
