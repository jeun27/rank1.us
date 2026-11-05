"use server";
import { redirect } from "next/navigation";
import { findLocalCompetitors, readSite } from "@/lib/onboarding";
import { MAX_ACTIVE_QUESTIONS } from "@/lib/questions/templates";
import { getLanding } from "@/lib/queries/auth";
import type { DbClient } from "@/lib/queries/client";
import { getCachedLookup, putCachedLookup } from "@/lib/queries/lookup-cache";
import { takeRateToken } from "@/lib/queries/rate-limits";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/db";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { CompetitorQuery, CompetitorSearch, OnboardingInput, SiteRead } from "./contract";
import { withLimits, type LookupStore } from "@/lib/onboarding/limits";
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

// Rate tokens with the caller's client (take_rate_token); the 24 h result cache with the
// service client, because users must not write their own cached results.
function storeFor({ db, userId }: { db: DbClient; userId: string }): LookupStore {
  const svc = createServiceClient();
  return {
    take: (kind) => takeRateToken(db, kind),
    cached: (kind, key, maxAgeMs) => getCachedLookup(svc, userId, kind, key, maxAgeMs / 1000),
    save: (kind, key, result) => putCachedLookup(svc, { user_id: userId, kind, key, result: result as Json }),
  };
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
  try {
    await createBusinessOnboarding(await createClient(), input);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "save_failed" };
  }
  redirect("/app");
}
