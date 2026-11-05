import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

// Every query takes the caller's client, so RLS decides what it can see.
export type DbClient = SupabaseClient<Database>;
