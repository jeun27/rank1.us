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
import { listConnections } from "@/lib/queries/connections";
import { applyGbpEdit, previewGbpEdit } from "@/lib/connections/service";
import type { Change } from "@/lib/connections/gbp";

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

// C-c PR 2: the team edits a DFY client's Business Profile, v1 only these text fields (lead Q3). Public
// endpoints, so the input is checked here; the service re-checks the team's access and the allowlist.
const GBP_TEXT_FIELDS = ["description", "website_uri", "primary_phone"] as const;
type GbpTextEdit = Partial<Record<(typeof GBP_TEXT_FIELDS)[number], string>>;
const validEdit = (e: unknown): e is GbpTextEdit =>
  !!e &&
  typeof e === "object" &&
  Object.keys(e).length > 0 &&
  Object.entries(e).every(
    ([k, v]) => (GBP_TEXT_FIELDS as readonly string[]).includes(k) && typeof v === "string" && v.length <= 2000,
  );

type GbpTarget =
  | { ok: true; ctx: { userDb: DbClient; serviceDb: DbClient }; connectionId: string; edit: GbpTextEdit }
  | { ok: false; error: string };

async function gbpTarget(businessId: string, location: string, edit: unknown): Promise<GbpTarget> {
  if (process.env.ENABLE_CONNECTIONS !== "true") return { ok: false, error: "disabled" };
  if (typeof location !== "string" || !location || location.length > 200 || !validEdit(edit))
    return { ok: false, error: "bad_input" };
  const db = await createClient();
  if (!(await listDfyBusinesses(db)).some((b) => b.id === businessId)) return { ok: false, error: "not_found" };
  const gbp = (await listConnections(db, businessId)).find((c) => c.provider === "gbp" && c.status === "connected");
  if (!gbp) return { ok: false, error: "not_connected" };
  return { ok: true, ctx: { userDb: db, serviceDb: createServiceClient() }, connectionId: gbp.id, edit };
}

export async function previewTeamGbpEdit(
  businessId: string,
  location: string,
  edit: GbpTextEdit,
): Promise<{ changes: Change[] } | { error: string }> {
  const t = await gbpTarget(businessId, location, edit);
  if (!t.ok) return { error: t.error };
  try {
    const r = await previewGbpEdit(t.ctx, t.connectionId, location, t.edit);
    return typeof r === "string" ? { error: r } : r;
  } catch {
    return { error: "save_failed" };
  }
}

export async function applyTeamGbpEdit(
  businessId: string,
  location: string,
  edit: GbpTextEdit,
  confirmed: Change[],
): Promise<{ applied: number } | { error: string }> {
  const t = await gbpTarget(businessId, location, edit);
  if (!t.ok) return { error: t.error };
  if (!Array.isArray(confirmed)) return { error: "bad_input" };
  try {
    const r = await applyGbpEdit(t.ctx, t.connectionId, location, t.edit, confirmed);
    if (typeof r === "string") return { error: r };
    revalidatePath("/team");
    return r;
  } catch {
    return { error: "save_failed" };
  }
}
