"use server";
import { revalidatePath } from "next/cache";
import { setFixStatus, type FixStatus } from "@/lib/queries/fixes";
import { addCompetitor, dismissSuggestion, type CompetitorInput } from "@/lib/queries/shell";
import { listDfyBusinesses } from "@/lib/queries/team";
import type { DbClient } from "@/lib/queries/client";
import { createClient } from "@/lib/supabase/server";

// Team writes for a DFY client. The browser names the client, so it must be one the caller can read
// as DFY; the RPCs and RLS check the role again.
async function run(businessId: string, fn: (db: DbClient) => Promise<unknown>) {
  const db = await createClient();
  if (!(await listDfyBusinesses(db)).some((b) => b.id === businessId)) return { error: "not_found" };
  try {
    await fn(db);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "failed" };
  }
  revalidatePath("/team");
}

export async function setTeamFixStatus(businessId: string, fixId: string, status: FixStatus) {
  return run(businessId, (db) => setFixStatus(db, fixId, status));
}

export async function addTeamCompetitor(businessId: string, c: CompetitorInput) {
  return run(businessId, (db) => addCompetitor(db, businessId, { ...c, source: c.maps_cid ? "maps" : "manual" }));
}

export async function dismissTeamSuggestion(businessId: string, c: CompetitorInput) {
  return run(businessId, (db) => dismissSuggestion(db, businessId, c));
}
