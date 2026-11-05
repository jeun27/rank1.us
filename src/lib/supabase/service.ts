import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { DbClient } from "@/lib/queries/client";

// Service-role client: bypasses RLS. Server routes only (contact_requests, leads).
export function createServiceClient(): DbClient {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
