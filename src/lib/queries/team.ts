import type { DbClient } from "./client";

export type DfyBusiness = {
  id: string;
  name: string;
  domain: string | null;
  cuisine: string | null;
  city: string;
  state: string;
  country: string;
  fix_list_visible: boolean;
};

// Active DFY businesses the caller can read, by name. Through RLS a team user gets every DFY
// business; anyone else only the DFY businesses of their own workspace (a dfy_client: theirs).
export async function listDfyBusinesses(db: DbClient): Promise<DfyBusiness[]> {
  const { data, error } = await db
    .from("businesses")
    .select("id, name, domain, cuisine, city, state, country, fix_list_visible")
    .eq("service", "dfy")
    .is("archived_at", null)
    .order("name")
    .order("id");
  if (error) throw error;
  return data;
}

export type TeamQueueRow = {
  id: string;
  name: string;
  // The newest complete/partial run's visibility (null with none); delta = its floored % minus the
  // next one's (null without two runs that have answers).
  named: number | null;
  n: number | null;
  delta: number | null;
  open_fixes: number;
  // A fix the team has started (doing, not a tidy-up) or any done fix.
  started: boolean;
  gas_ready: boolean;
  needs_reauth: boolean;
  last_run_failed: boolean;
};

// Rank1 team only (42501 otherwise): the /team client queue, every active DFY business by name, in
// one call (replaces 5 calls per client). No emails or rule internals.
export async function listTeamClientQueue(db: DbClient): Promise<TeamQueueRow[]> {
  const { data, error } = await db.rpc("team_client_queue");
  if (error) throw error;
  return data as TeamQueueRow[];
}
