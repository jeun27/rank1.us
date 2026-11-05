"use server";
import { redirect } from "next/navigation";
import { MAX_ACTIVE_QUESTIONS } from "@/lib/questions/templates";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { CompetitorQuery, CompetitorSearch, OnboardingInput, SiteRead } from "./contract";

// Stand-ins until feat/step5-onboarding-engines lands: they report what no keys / no fetch would.
export async function readSiteAction(domain: string): Promise<SiteRead> {
  void domain;
  return { status: "unreadable" };
}

export async function findCompetitorsAction(q: CompetitorQuery): Promise<CompetitorSearch> {
  void q;
  return { status: "missing_keys", items: [] };
}

// The RPC enforces the limits too; this keeps a tampered payload from reaching it half-filled.
export async function finishAction(input: OnboardingInput): Promise<{ error: string } | undefined> {
  const active = input.questions.filter((q) => q.active);
  if (
    !input.business.name?.trim() ||
    active.length > MAX_ACTIVE_QUESTIONS ||
    active.some((q) => !q.short_text.trim() || !q.long_text.trim())
  )
    return { error: "invalid" };
  try {
    await createBusinessOnboarding(await createClient(), input);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "save_failed" };
  }
  redirect("/app");
}
