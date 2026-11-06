import "server-only";
import { connection } from "next/server";
import { loadPaidRun } from "@/components/audit/load";
import type { FirstCheck } from "@/components/ui/EmptyState";
import { seriesFromSummaries } from "@/lib/metrics";
import { getCurrentBusiness, listRunSummaries } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";
import { selectedBusinessId } from "@/app/app/current";

// The signed-in member's current business (oldest active, lead) and its latest complete/partial run.
export async function loadShell() {
  await connection();
  const db = await createClient();
  const business = await getCurrentBusiness(db, await selectedBusinessId());
  if (!business) return { db, business: null, runs: [], latest: null, userId: null };
  const runs = await listRunSummaries(db, business.id, 8, ["complete", "partial"]);
  const latest = runs[0] ? await loadPaidRun(runs[0].id) : null;
  // X25: before any result, is a first check already queued or running?
  const pending = runs.length ? [] : await listRunSummaries(db, business.id, 1, ["queued", "running"]);
  const firstCheck: FirstCheck = pending.length ? "running" : "monday";
  const userId = (await db.auth.getUser()).data.user?.id ?? null;
  return { db, business, runs, latest, userId, series: seriesFromSummaries(runs), firstCheck };
}
