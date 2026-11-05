import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/db";

// Browser client acting as the signed-in user (RLS applies).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
