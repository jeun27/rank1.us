"use server";
import { revalidatePath } from "next/cache";
import { storeFor } from "@/app/app/lookup-store";
import { suggestCompetitors } from "@/lib/onboarding";
import type { LocalCompetitor } from "@/lib/onboarding/types";
import { setFixStatus, type FixStatus } from "@/lib/queries/fixes";
import { addCompetitor, dismissSuggestion, listCompetitors, type CompetitorInput } from "@/lib/queries/shell";
import { listDfyBusinesses } from "@/lib/queries/team";
import type { DbClient } from "@/lib/queries/client";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLanding } from "@/lib/queries/auth";
import { inviteClient, removeClient, setFixListVisible, type InviteStatus } from "@/lib/queries/clients";
import { dismissGasReady } from "@/lib/queries/gas-ready";
import { validMentionDecision, type MentionStatus } from "@/lib/mentions/input";
import { decideMention } from "@/lib/mentions/service";
import { narrativeErrorCode, parseNarrativeWords } from "@/lib/narrative/input";
import { setNarrativeWords, type NarrativeWords } from "@/lib/queries/narrative";

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

// Maps suggestions for a DFY client, through the 24 h cache and the caller's maps_lookup token (as
// /app does). Called only when the Competitors view opens, so switching clients costs nothing.
export async function teamSuggestions(businessId: string): Promise<LocalCompetitor[]> {
  const db = await createClient();
  const business = (await listDfyBusinesses(db)).find((b) => b.id === businessId);
  const userId = (await db.auth.getUser()).data.user?.id;
  if (!business || !userId) return [];
  const known = await listCompetitors(db, business.id);
  return (await suggestCompetitors({ business, ...known }, { store: storeFor({ db, userId }) })).items;
}

// Step 12: client users of a DFY client. The caller must be team (my_landing) and the business a DFY
// client they can read; invites and removals then run with the service role (server only).
async function teamDfy(businessId: string) {
  const db = await createClient();
  if ((await getLanding(db)) !== "team") return null;
  return (await listDfyBusinesses(db)).some((b) => b.id === businessId) ? db : null;
}

export async function inviteTeamClient(businessId: string, email: string): Promise<{ status: InviteStatus }> {
  if (!(await teamDfy(businessId))) return { status: "error" };
  try {
    const result = await inviteClient(createServiceClient(), { email, businessId });
    if (result.status === "invited") revalidatePath("/team");
    return result;
  } catch {
    // Status codes only: never log or echo the email.
    return { status: "error" };
  }
}

export async function removeTeamClient(businessId: string, userId: string) {
  if (!(await teamDfy(businessId))) return { error: "not_found" };
  try {
    await removeClient(createServiceClient(), { userId, businessId });
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "failed" };
  }
  revalidatePath("/team");
}

export async function setTeamFixListVisible(businessId: string, visible: boolean) {
  const db = await teamDfy(businessId);
  if (!db) return { error: "not_found" };
  try {
    await setFixListVisible(db, businessId, visible);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "failed" };
  }
  revalidatePath("/team");
}

// C-c: the team dismisses a DFY client's G3 ready notice (ENABLE_CONNECTIONS). dismiss_gas_ready checks the team.
export async function dismissTeamReady(businessId: string) {
  if (process.env.ENABLE_CONNECTIONS !== "true") return { error: "disabled" };
  return run(businessId, (db) => dismissGasReady(db, businessId));
}

// C-c D3: the team sets a DFY client's narrative words (ENABLE_NARRATIVE). set_narrative_words checks the team.
export async function saveTeamNarrativeWords(
  businessId: string,
  input: NarrativeWords,
): Promise<{ ok: true } | { error: string }> {
  if (process.env.ENABLE_NARRATIVE !== "true") return { error: "disabled" };
  const words = parseNarrativeWords(input);
  if (!words) return { error: "bad_input" };
  const db = await createClient();
  if (!(await listDfyBusinesses(db)).some((b) => b.id === businessId)) return { error: "not_found" };
  try {
    await setNarrativeWords(db, businessId, words);
  } catch (e) {
    return { error: narrativeErrorCode(e) };
  }
  revalidatePath("/team");
  return { ok: true };
}

// C-c D4: the team decides a DFY client's mention lists (ENABLE_MENTIONS, checked by decideMention), which also
// upserts the grouped R17 fix. set_mention_target and upsert_mention_fix check the team.
export async function decideTeamMention(
  businessId: string,
  url: string,
  status: MentionStatus,
): Promise<{ fixId: string | null } | { error: string }> {
  if (!validMentionDecision(url, status)) return { error: "bad_input" };
  try {
    const db = await createClient();
    if (!(await listDfyBusinesses(db)).some((b) => b.id === businessId)) return { error: "not_found" };
    const r = await decideMention(db, businessId, url, status);
    if (typeof r === "string") return { error: r };
    revalidatePath("/team");
    return r;
  } catch {
    // Never the raw message.
    return { error: "save_failed" };
  }
}
