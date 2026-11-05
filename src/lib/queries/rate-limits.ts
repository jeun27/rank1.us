import type { DbClient } from "./client";

export type RateKind = "read_site" | "maps_lookup";

// Takes one token for the signed-in user: true when fewer than `max` events of this kind
// happened in the last `windowSeconds` (and records this one), false otherwise or when signed out.
export async function takeRateToken(
  db: DbClient,
  kind: RateKind,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await db.rpc("take_rate_token", {
    p_kind: kind,
    p_max: max,
    p_window: `${windowSeconds} seconds`,
  });
  if (error) throw error;
  return data;
}
