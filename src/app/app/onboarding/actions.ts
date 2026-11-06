"use server";
import { redirect } from "next/navigation";
import { readinessSet } from "@/lib/connections/recommend";
import { findLocalCompetitors, readSite } from "@/lib/onboarding";
import { MAX_ACTIVE_QUESTIONS } from "@/lib/questions/templates";
import { getLanding } from "@/lib/queries/auth";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { CompetitorQuery, CompetitorSearch, OnboardingInput, SiteRead } from "./contract";
import { withLimits } from "@/lib/onboarding/limits";
import { storeFor } from "../lookup-store";
import { lookupCompetitors } from "@/lib/onboarding/lookup";
import { MAX_SUGGESTED_COMPETITORS } from "@/lib/onboarding/competitors";

// Server actions are public endpoints: fetch sites or pay for Maps only for a signed-in
// self-serve owner who is still onboarding (team, DFY and set-up owners get the fallbacks).
async function onboardingClient() {
  const db = await createClient();
  const user = (await db.auth.getUser()).data.user;
  if (!user || (await getLanding(db)) !== "onboarding") return null;
  return { db, userId: user.id };
}

export async function readSiteAction(domain: string): Promise<SiteRead> {
  const caller = await onboardingClient();
  if (!caller) return { status: "unreadable" };
  const r = await withLimits(
    storeFor(caller),
    "read_site",
    domain,
    () => readSite(domain),
    (x) => x.status === "ok",
  );
  return r === "limited" ? { status: "unreadable" } : r;
}

// The UI shows only the COPY.md message, so the raw upstream error never leaves the server.
export async function findCompetitorsAction(q: CompetitorQuery): Promise<CompetitorSearch> {
  const caller = await onboardingClient();
  if (!caller) return { status: "error", items: [] };
  const r = await lookupCompetitors(storeFor(caller), q, findLocalCompetitors);
  // The cache holds the full Maps list; onboarding shows the top 5.
  return r === "limited"
    ? { status: "error", items: [] }
    : { status: r.status, items: r.items.slice(0, MAX_SUGGESTED_COMPETITORS) };
}

// The RPC enforces the limits too; this keeps a tampered payload from reaching it half-filled.
export async function finishAction(input: OnboardingInput): Promise<{ error: string } | undefined> {
  const active = input.questions.filter((q) => q.active);
  if (
    !input.business.name?.trim() ||
    active.length > MAX_ACTIVE_QUESTIONS ||
    active.some((q) => !q.short_text.trim() || !q.long_text?.trim())
  )
    return { error: "invalid" };
  // C-b: the vertical select and the connect step are behind ENABLE_CONNECTIONS (lead Q4).
  const connections = process.env.ENABLE_CONNECTIONS === "true";
  const { vertical, ...business } = input.business;
  try {
    await createBusinessOnboarding(await createClient(), connections ? input : { ...input, business });
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "save_failed" };
  }
  redirect(connections && readinessSet(vertical ?? "restaurant").length ? "/app/onboarding/connect" : "/app");
}
