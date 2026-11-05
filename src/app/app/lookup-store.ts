import "server-only";
import type { DbClient } from "@/lib/queries/client";
import { getCachedLookup, putCachedLookup } from "@/lib/queries/lookup-cache";
import { takeRateToken } from "@/lib/queries/rate-limits";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/db";
import type { LookupStore } from "@/lib/onboarding/limits";

// One signed-in user's lookups: rate tokens with their own client (take_rate_token), the 24 h
// result cache with the service client, because users must not write their own cached results.
export function storeFor({ db, userId }: { db: DbClient; userId: string }): LookupStore {
  const svc = createServiceClient();
  return {
    take: (kind) => takeRateToken(db, kind),
    cached: (kind, key, maxAgeMs) => getCachedLookup(svc, userId, kind, key, maxAgeMs / 1000),
    save: (kind, key, result) => putCachedLookup(svc, { user_id: userId, kind, key, result: result as Json }),
  };
}
