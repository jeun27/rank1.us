import "server-only";
import { connection } from "next/server";
import { loadPaidRun } from "@/components/audit/load";
import type { ClientFixes } from "@/components/client/ClientDashboard";
import { listFixes } from "@/lib/queries/fixes";
import { listRunSummaries } from "@/lib/queries/shell";
import { listDfyBusinesses } from "@/lib/queries/team";
import { createClient } from "@/lib/supabase/server";

// The signed-in DFY client's business (one per client user in v1), read through RLS: their own
// workspace's DFY business, nothing once access is removed. Fixes only when the team shows them.
export async function loadClient() {
  await connection();
  const db = await createClient();
  const [business] = await listDfyBusinesses(db);
  if (!business) return { business: null, latest: null, runs: [], fixes: null };
  // Every status for History; the line and the hero use complete/partial audit or weekly runs (Step 8).
  const runs = await listRunSummaries(db, business.id, 20);
  const done = runs.find((r) => r.status === "complete" || r.status === "partial");
  const [latest, list] = await Promise.all([
    done ? loadPaidRun(done.id) : null,
    business.fix_list_visible ? listFixes(db, business.id) : null,
  ]);
  const fixes: ClientFixes | null = list && { ...list, noDomain: !business.domain };
  return { business: { name: business.name }, latest, runs, fixes };
}
