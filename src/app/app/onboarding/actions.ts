"use server";
import { redirect } from "next/navigation";
import { readinessSet } from "@/lib/connections/recommend";
import { findLocalCompetitors } from "@/lib/onboarding";
import { readHome, readServices } from "@/lib/onboarding/site-profile";
import { MAX_ACTIVE_QUESTIONS } from "@/lib/questions/templates";
import { getLanding } from "@/lib/queries/auth";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";
import { listLocalPlaces } from "@/lib/queries/places";
import type {
  CompetitorQuery,
  CompetitorSearch,
  LocalPlace,
  OnboardingInput,
  SiteProfile,
  SiteServices,
} from "./contract";
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

// UI2: the two reading stages are separate actions so the log ticks on real progress. Each fetches the site,
// so each takes a read_site token (cached per stage and domain for 24 h).
export async function readHomeAction(domain: string): Promise<SiteProfile> {
  const unreadable: SiteProfile = { status: "unreadable", areaServed: [], sameAs: [], sources: {} };
  const caller = await onboardingClient();
  if (!caller) return unreadable;
  const r = await withLimits(storeFor(caller), "read_site", `home:${domain}`, () => readHome(domain), ok);
  return r === "limited" ? unreadable : r;
}

export async function readServicesAction(domain: string): Promise<SiteServices> {
  const unreadable: SiteServices = { status: "unreadable", services: [], source: null };
  const caller = await onboardingClient();
  if (!caller) return unreadable;
  const r = await withLimits(storeFor(caller), "read_site", `services:${domain}`, () => readServices(domain), ok);
  return r === "limited" ? unreadable : r;
}
const ok = (x: { status: string }) => x.status === "ok";

// UI3: the places for the card's city (no more hard-coded Irvine). Reads Rank1's own table, no outbound call.
export async function placesAction(city: string, state: string): Promise<LocalPlace[]> {
  const caller = await onboardingClient();
  if (!caller || !city.trim() || !state.trim()) return [];
  return listLocalPlaces(caller.db, city.trim(), state.trim()).catch(() => []);
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
  // C-b: the connect step is behind ENABLE_CONNECTIONS (lead Q4). UI3: the vertical is always saved, since the
  // card's business type picks the questions.
  const connections = process.env.ENABLE_CONNECTIONS === "true";
  const vertical = input.business.vertical;
  try {
    await createBusinessOnboarding(await createClient(), input);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "save_failed" };
  }
  redirect(connections && readinessSet(vertical ?? "restaurant").length ? "/app/onboarding/connect" : "/app");
}
