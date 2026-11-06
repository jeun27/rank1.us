import "server-only";
import type { DbClient } from "@/lib/queries/client";
import { listTeamClientQueue } from "@/lib/queries/team";
import { queueRowFromRpc, sortQueue, type QueueRow } from "@/lib/workspace/queue";

// X5: one row per DFY client, in one call (team_client_queue, 0038). The per-client reads it replaces ran
// out of Kong connections at ~120 clients (v0.8.0 blocker).
export async function loadQueue(db: DbClient): Promise<QueueRow[]> {
  const g3 = process.env.ENABLE_CONNECTIONS === "true";
  return sortQueue((await listTeamClientQueue(db)).map((r) => queueRowFromRpc(r, g3)));
}
