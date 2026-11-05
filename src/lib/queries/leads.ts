import type { TablesInsert } from "@/types/db";
import type { DbClient } from "./client";

// leads is service-role only (RLS on, no policies): pass the service client.

export async function insertLead(db: DbClient, row: TablesInsert<"leads">): Promise<string> {
  const { data, error } = await db.from("leads").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

// All leads created at or after `since`, from every visitor (the daily audit cap).
export async function countLeadsSince(db: DbClient, since: Date): Promise<number> {
  const { count, error } = await db.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}
