import "server-only";
import { connection } from "next/server";
import { loadPaidRun } from "@/components/audit/load";
import { loadConnectCard } from "@/components/connections/load";
import { loadDashboardNarrative } from "@/components/narrative/load";
import type { ClientFixes } from "@/components/client/ClientDashboard";
import { listDoneFixes, listFixes } from "@/lib/queries/fixes";
import { listRunSummaries } from "@/lib/queries/shell";
import { listDfyBusinesses } from "@/lib/queries/team";
import { createClient } from "@/lib/supabase/server";

// The signed-in DFY client's business (one per client user in v1), read through RLS: their own
// workspace's DFY business, nothing once access is removed. Fixes only when the team shows them.
export async function loadClient() {
  await connection();
  const db = await createClient();
  const [business] = await listDfyBusinesses(db);
  if (!business) return { business: null, latest: null, runs: [], fixes: null, card: null, narrative: null };
  // Every status for History; the line and the hero use complete/partial audit or weekly runs (Step 8).
  const runs = await listRunSummaries(db, business.id, 20);
  const done = runs.find((r) => r.status === "complete" || r.status === "partial");
  // Q4: the words and their match, read with the client's own session (ENABLE_NARRATIVE; null otherwise).
  const [latest, list, card, narrative] = await Promise.all([
    done ? loadPaidRun(done.id) : null,
    business.fix_list_visible ? Promise.all([listFixes(db, business.id), listDoneFixes(db, business.id)]) : null,
    loadConnectCard(db, business.id, new Date()),
    loadDashboardNarrative(db, business.id),
  ]);
  const fixes: ClientFixes | null = list && { ...list[0], done: list[1], noDomain: !business.domain };
  return { business: { id: business.id, name: business.name }, latest, runs, fixes, card, narrative };
}
