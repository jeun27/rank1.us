import type { DbClient } from "./client";

// Limits live in SQL (take_rate_token): read_site 10/hour, maps_lookup 5/hour and 20/24 hours.
export type RateKind = "read_site" | "maps_lookup";

// Takes one token for the signed-in user: true when under the kind's limits (and records one
// event), false when over them or signed out.
export async function takeRateToken(db: DbClient, kind: RateKind): Promise<boolean> {
  const { data, error } = await db.rpc("take_rate_token", { p_kind: kind });
  if (error) throw error;
  return data;
}
