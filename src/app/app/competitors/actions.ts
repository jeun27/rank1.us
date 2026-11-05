"use server";
import { revalidatePath } from "next/cache";
import { addCompetitor, dismissSuggestion, getCurrentBusiness, type CompetitorInput } from "@/lib/queries/shell";
import type { DbClient } from "@/lib/queries/client";
import { createClient } from "@/lib/supabase/server";

// The business comes from the session, never from the browser; RLS checks membership again.
async function run(
  fn: (db: DbClient, businessId: string, input: CompetitorInput) => Promise<unknown>,
  input: CompetitorInput,
) {
  const db = await createClient();
  const business = await getCurrentBusiness(db);
  if (!business) return { error: "no_business" };
  try {
    await fn(db, business.id, input);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "failed" };
  }
  revalidatePath("/app/competitors");
}

// A Maps suggestion keeps its cid (source 'maps'); the manual form has none (source 'manual').
export async function addCompetitorAction(input: CompetitorInput) {
  return run((db, id, c) => addCompetitor(db, id, { ...c, source: c.maps_cid ? "maps" : "manual" }), input);
}

export async function dismissSuggestionAction(input: CompetitorInput) {
  return run(dismissSuggestion, input);
}
