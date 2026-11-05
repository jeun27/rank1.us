"use server";
import { redirect } from "next/navigation";
import { findLocalCompetitors, readSite } from "@/lib/onboarding";
import { MAX_ACTIVE_QUESTIONS } from "@/lib/questions/templates";
import { getLanding } from "@/lib/queries/auth";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { CompetitorQuery, CompetitorSearch, OnboardingInput, SiteRead } from "./contract";

// Server actions are public endpoints: fetch sites or pay for Maps only for a signed-in
// self-serve owner who is still onboarding (team, DFY and set-up owners get the fallbacks).
async function signedIn() {
  const db = await createClient();
  if (!(await db.auth.getUser()).data.user) return false;
  return (await getLanding(db)) === "onboarding";
}

export async function readSiteAction(domain: string): Promise<SiteRead> {
  if (!(await signedIn())) return { status: "unreadable" };
  return readSite(domain);
}

// The UI shows only the COPY.md message, so the raw upstream error never leaves the server.
export async function findCompetitorsAction(q: CompetitorQuery): Promise<CompetitorSearch> {
  if (!(await signedIn())) return { status: "error", items: [] };
  const { status, items } = await findLocalCompetitors(q);
  return { status, items };
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
  try {
    await createBusinessOnboarding(await createClient(), input);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "save_failed" };
  }
  redirect("/app");
}
