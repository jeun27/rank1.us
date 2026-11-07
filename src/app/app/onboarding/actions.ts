"use server";
import { redirect } from "next/navigation";
import { readinessSet } from "@/lib/connections/recommend";
import { findLocalCompetitors } from "@/lib/onboarding";
import { readHomeStage, readSitemapServices } from "@/lib/onboarding/site-profile";
import { MAX_ACTIVE_QUESTIONS } from "@/lib/questions/templates";
import { getLanding } from "@/lib/queries/auth";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { CompetitorQuery, CompetitorSearch, OnboardingInput, SiteProfile, SiteServices } from "./contract";
import { CACHE_MS, withLimits } from "@/lib/onboarding/limits";
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

// UI2: the two reading stages are separate actions so the log ticks on real progress. #213 review: one press
// costs one read_site token and fetches the home page once. Stages 1–3 take the token, read the home page
// (profile + the services it lists) and cache both for 24 h; stage 4 answers from that cache, and only
// fetches the sitemap when the home page listed no services, once (its result is cached with the home stage).
type HomeStage = Awaited<ReturnType<typeof readHomeStage>>;
const stageKey = (domain: string) => `stage:${domain}`;

export async function readHomeAction(domain: string): Promise<SiteProfile> {
  const unreadable: SiteProfile = { status: "unreadable", areaServed: [], sameAs: [], sources: {} };
  const caller = await onboardingClient();
  if (!caller) return unreadable;
  const r = await withLimits(
    storeFor(caller),
    "read_site",
    stageKey(domain),
    () => readHomeStage(domain),
    (x) => x.profile.status === "ok",
  );
  return r === "limited" ? unreadable : r.profile;
}

export async function readServicesAction(domain: string): Promise<SiteServices> {
  const unreadable: SiteServices = { status: "unreadable", services: [], source: null };
  const caller = await onboardingClient();
  if (!caller) return unreadable;
  // No token of its own: it only runs after this user's stages 1–3 for the same domain.
  const store = storeFor(caller);
  const home = (await store.cached("read_site", stageKey(domain), CACHE_MS)) as HomeStage | null;
  if (home?.profile.status !== "ok") return unreadable;
  if (home.services) return home.services;
  // #216 review: the sitemap result joins the home-stage entry, so a repeat call fetches nothing.
  const services = await readSitemapServices(domain);
  await store.save("read_site", stageKey(domain), { ...home, services });
  return services;
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
