import type { DbClient } from "./client";

// Weekly runs (Step 13). Service client only; results are counts, never business names.

export type EnqueueResult = { enqueued: number; skipped: number; failed: number };
export type PruneResult = { lookup_cache: number; rate_events: number };

// The Monday (YYYY-MM-DD) of the week containing `now`, in America/Los_Angeles.
export function laWeekStart(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const day = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) - back));
  return day.toISOString().slice(0, 10);
}

// Starts this week's weekly run for every eligible business (paid or DFY, not archived) that has
// no weekly run this LA week and no open run. Idempotent. weekStart must be laWeekStart(now).
// Errors: 42501 not the service role, 22023 not the current week's Monday.
export async function enqueueWeeklyRuns(serviceDb: DbClient, weekStart: string): Promise<EnqueueResult> {
  const { data, error } = await serviceDb.rpc("enqueue_weekly_runs", { p_week_start: weekStart });
  if (error) throw error;
  return data as unknown as EnqueueResult;
}

// Deletes lookup_cache rows over 24 h old and rate_events over 48 h old; returns how many.
export async function pruneEphemeral(serviceDb: DbClient): Promise<PruneResult> {
  const { data, error } = await serviceDb.rpc("prune_ephemeral");
  if (error) throw error;
  return data as unknown as PruneResult;
}
