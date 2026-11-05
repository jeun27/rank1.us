import type { TablesInsert } from "@/types/db";
import type { DbClient } from "./client";

// contact_requests is service-role only (RLS on, no policies): pass the service client.

export async function insertContactRequest(db: DbClient, row: TablesInsert<"contact_requests">): Promise<string> {
  const { data, error } = await db.from("contact_requests").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

// Rows from this IP hash created at or after `since` (the rate-limit window).
export async function countRecentContactRequests(db: DbClient, ipHash: string, since: Date): Promise<number> {
  const { count, error } = await db
    .from("contact_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function markContactRequestEmailed(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from("contact_requests").update({ emailed: true }).eq("id", id);
  if (error) throw error;
}
