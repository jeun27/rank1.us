import type { Tables } from "@/types/db";
import type { DbClient } from "./client";

export type Workspace = Tables<"workspaces">;

// The signed-in user's workspace: their oldest membership. Null when signed out or without one.
export async function getCurrentWorkspace(db: DbClient): Promise<Workspace | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await db
    .from("workspace_members")
    .select("created_at, workspaces(*)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.workspaces ?? null;
}
