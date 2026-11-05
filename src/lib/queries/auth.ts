import type { DbClient } from "./client";

// Where a signed-in user lands, from public.my_landing().
export const LANDINGS = ["team", "dfy_client", "onboarding", "dashboard"] as const;
export type Landing = (typeof LANDINGS)[number];

// The caller's workspace id, created with them as owner on the first self-serve sign-in.
// Null for team and dfy_client users, who never get a self-serve workspace.
export async function ensureSelfServeWorkspace(db: DbClient): Promise<string | null> {
  const { data, error } = await db.rpc("ensure_self_serve_workspace");
  if (error) throw error;
  return data;
}

// Null when signed out.
export async function getLanding(db: DbClient): Promise<Landing | null> {
  const { data, error } = await db.rpc("my_landing");
  if (error) throw error;
  if (data === null) return null;
  if (!(LANDINGS as readonly string[]).includes(data)) throw new Error(`Unknown landing: ${data}`);
  return data as Landing;
}
