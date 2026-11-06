import { metric } from "@/lib/metrics/compute";
import type { TeamQueueRow } from "@/lib/queries/team";
import type { Metric } from "@/types/metrics";

// X5: the /team client queue. Tags are the lead-approved G3 team tags (COPY.md GAS); In progress is
// neutral because info blue is kept for You and info (R2).
export const QUEUE_TAGS = {
  attention: { label: "Needs attention", tone: "error" },
  ready: { label: "Ready for GAS", tone: "success" },
  waiting: { label: "Waiting on client", tone: "warn" },
  progress: { label: "In progress", tone: "neutral" },
} as const;
export type QueueTag = keyof typeof QUEUE_TAGS;

export type QueueRow = {
  id: string;
  name: string;
  // null when G3 is off (ENABLE_CONNECTIONS): no tag column.
  tag: QueueTag | null;
  visibility: Metric | null;
  delta: number | null;
  open: number;
};

// A connection needing reauth or a failed last run needs the team. A partial run still has data (warn
// badge). A revoked connection is the client's choice: if it was required, G3 makes it Waiting on client.
export function queueTag(s: {
  lastRunFailed: boolean;
  connections: ("connected" | "needs_reauth" | "revoked")[];
  gasReady: boolean;
  started: boolean;
}) {
  if (s.connections.includes("needs_reauth") || s.lastRunFailed) return "attention" as const;
  if (!s.gasReady) return "waiting" as const;
  return s.started ? ("progress" as const) : ("ready" as const);
}

const ORDER: QueueTag[] = ["attention", "ready", "waiting", "progress"];

export const sortQueue = (rows: QueueRow[]) =>
  [...rows].sort(
    (a, b) =>
      (a.tag && b.tag ? ORDER.indexOf(a.tag) - ORDER.indexOf(b.tag) : 0) ||
      b.open - a.open ||
      a.name.localeCompare(b.name),
  );

// One team_client_queue() row (0038, counted as the per-client reads were) as a queue row. g3 is
// ENABLE_CONNECTIONS: without it there's no tag column.
export const queueRowFromRpc = (r: TeamQueueRow, g3: boolean): QueueRow => ({
  id: r.id,
  name: r.name,
  tag: g3
    ? queueTag({
        lastRunFailed: r.last_run_failed,
        connections: r.needs_reauth ? ["needs_reauth"] : [],
        gasReady: r.gas_ready,
        started: r.started,
      })
    : null,
  visibility: r.named == null || r.n == null ? null : metric(r.named, r.n),
  delta: r.delta,
  open: r.open_fixes,
});
