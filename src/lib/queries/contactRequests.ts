import type { TablesInsert } from "@/types/db";
import type { DbClient } from "./client";

// contact_requests is service-role only (RLS on, no policies): pass the service client.

// Same list and rules as the contact_requests checks (migration 20261105000007).
export const INDUSTRIES = ["Restaurant", "HVAC", "Plumbing", "Roofing", "Pest control", "Other"] as const;
export type Industry = (typeof INDUSTRIES)[number];
export const INDUSTRY_OTHER_MAX = 60;

// industry_other (max 60 chars) is only allowed when industry is "Other".
export type ContactRequestInsert = Omit<TablesInsert<"contact_requests">, "industry" | "industry_other"> &
  ({ industry: Exclude<Industry, "Other">; industry_other?: null } | { industry: "Other"; industry_other?: string | null });

export async function insertContactRequest(db: DbClient, row: ContactRequestInsert): Promise<string> {
  const insert: TablesInsert<"contact_requests"> = row;
  const { data, error } = await db.from("contact_requests").insert(insert).select("id").single();
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
