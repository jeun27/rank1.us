"use server";
import { redirect } from "next/navigation";
import { findLocalCompetitors, readSite } from "@/lib/onboarding";
import { MAX_ACTIVE_QUESTIONS } from "@/lib/questions/templates";
import { getLanding } from "@/lib/queries/auth";
import type { DbClient } from "@/lib/queries/client";
import { takeRateToken } from "@/lib/queries/rate-limits";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { CompetitorQuery, CompetitorSearch, OnboardingInput, SiteRead } from "./contract";
import { withLimits, type LookupStore } from "./limits";

// Server actions are public endpoints: fetch sites or pay for Maps only for a signed-in
// self-serve owner who is still onboarding (team, DFY and set-up owners get the fallbacks).
async function onboardingClient() {
  const db = await createClient();
  if (!(await db.auth.getUser()).data.user) return null;
  return (await getLanding(db)) === "onboarding" ? db : null;
}

// Rate tokens in the DB (take_rate_token); the 24 h result cache joins it here.
const storeFor = (db: DbClient): LookupStore => ({
  take: (kind) => takeRateToken(db, kind),
  cached: async () => null,
  save: async () => {},
});

export async function readSiteAction(domain: string): Promise<SiteRead> {
  const db = await onboardingClient();
  if (!db) return { status: "unreadable" };
  const r = await withLimits(
    storeFor(db),
    "read_site",
    domain,
    () => readSite(domain),
    (x) => x.status === "ok",
  );
  return r === "limited" ? { status: "unreadable" } : r;
}

// The UI shows only the COPY.md message, so the raw upstream error never leaves the server.
export async function findCompetitorsAction(q: CompetitorQuery): Promise<CompetitorSearch> {
  const db = await onboardingClient();
  if (!db) return { status: "error", items: [] };
  const key = [
    q.cuisine.trim().toLowerCase(),
    q.city.trim().toLowerCase(),
    q.state.trim().toUpperCase(),
    q.domain,
  ].join("|");
  const r = await withLimits(
    storeFor(db),
    "maps_lookup",
    key,
    async (): Promise<CompetitorSearch> => {
      const { status, items } = await findLocalCompetitors(q);
      return { status, items };
    },
    (x) => x.status === "ok",
  );
  return r === "limited" ? { status: "error", items: [] } : r;
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
