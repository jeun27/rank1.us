import "server-only";
import type { DbClient } from "@/lib/queries/client";
import { listConnections } from "@/lib/queries/connections";
import { listDoneFixes, listFixes } from "@/lib/queries/fixes";
import { getGasReady } from "@/lib/queries/gas-ready";
import { listRunSummaries } from "@/lib/queries/shell";
import { queueTag, sortQueue, type QueueRow } from "@/lib/workspace/queue";
import { floorPct } from "@/lib/metrics/compute";

// X5: one row per DFY client. DFY clients are hand-onboarded (a handful to a few dozen), so this reads
// per client in parallel; move it to a view if the count grows past ~25.
export async function loadQueue(db: DbClient, businesses: { id: string; name: string }[]): Promise<QueueRow[]> {
  const g3 = process.env.ENABLE_CONNECTIONS === "true";
  const rows = await Promise.all(
    businesses.map(async (b): Promise<QueueRow> => {
      const [runs, fixes, done, gas, connections] = await Promise.all([
        listRunSummaries(db, b.id, 3),
        listFixes(db, b.id),
        g3 ? listDoneFixes(db, b.id) : [],
        g3 ? getGasReady(db, b.id) : null,
        g3 ? listConnections(db, b.id) : [],
      ]);
      const good = runs.filter((r) => r.status === "complete" || r.status === "partial");
      const visibility = good[0]?.visibility ?? null;
      const [now, before] = [visibility && floorPct(visibility), good[1] && floorPct(good[1].visibility)];
      return {
        id: b.id,
        name: b.name,
        tag: g3
          ? queueTag({
              lastRunFailed: runs[0]?.status === "failed",
              connections: connections.map((c) => c.status),
              gasReady: Boolean(gas?.readyAt),
              started: fixes.ranked.some((f) => f.status === "doing") || done.length > 0,
            })
          : null,
        visibility,
        delta: now != null && before != null ? now - before : null,
        open: fixes.ranked.length + fixes.tidyUps.length,
      };
    }),
  );
  return sortQueue(rows);
}
