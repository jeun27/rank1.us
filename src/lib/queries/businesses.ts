import type { Tables } from "@/types/db";
import type { DbClient } from "./client";

export type Business = Tables<"businesses">;

// Active (not archived) businesses in a workspace, by name.
export async function listBusinesses(db: DbClient, workspaceId: string): Promise<Business[]> {
  const { data, error } = await db
    .from("businesses")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}
