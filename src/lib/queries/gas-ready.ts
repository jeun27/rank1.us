import type { DbClient } from "./client";
import type { ConnectorKey } from "./connections";

// G3 "Ready for GAS" (0027): set the first time every Recommended connection is connected, cleared
// (with the notice's dismissal) when one drops.

// Service client only. recommended = the business's Recommended providers from recommend.ts. Call
// after every connection save/revoke/status change; send the team email only when newlyReady.
export async function refreshGasReady(
  serviceDb: DbClient,
  businessId: string,
  recommended: ConnectorKey[] | string[],
): Promise<{ ready: boolean; newlyReady: boolean }> {
  const { data, error } = await serviceDb.rpc("refresh_gas_ready", {
    p_business_id: businessId,
    p_recommended: recommended,
  });
  if (error) throw error;
  const r = data as { ready: boolean; newly_ready: boolean };
  return { ready: r.ready, newlyReady: r.newly_ready };
}

// For members (incl. the dfy_client) and the team on DFY; null for anyone else. showNotice is the
// team's notice (U3): ready, not dismissed, and the team hasn't moved a fix since.
export async function getGasReady(
  db: DbClient,
  businessId: string,
): Promise<{ readyAt: string | null; showNotice: boolean } | null> {
  const { data, error } = await db.rpc("gas_ready", { p_business_id: businessId });
  if (error) throw error;
  const row = data[0];
  return row ? { readyAt: row.ready_at, showNotice: row.show_notice } : null;
}

// The team on a DFY business only (42501 otherwise).
export async function dismissGasReady(db: DbClient, businessId: string): Promise<void> {
  const { error } = await db.rpc("dismiss_gas_ready", { p_business_id: businessId });
  if (error) throw error;
}
