import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOnboardingState } from "@/lib/queries/onboarding";
import { listLocalPlaces } from "@/lib/queries/places";
import { TEMPLATES } from "@/lib/questions/templates";
import { createClient } from "@/lib/supabase/server";
import { Onboarding } from "./Onboarding";
import { findCompetitorsAction, finishAction, readSiteAction } from "./actions";

export const metadata: Metadata = { title: "Add your business - Rank1", robots: { index: false } };

// First area: Irvine, CA (docs/PRODUCT.md). Cuisines: the templates' fixed cuisines until CUISINES lands.
const CITY = "Irvine";
const STATE = "CA";
const cuisines = [...new Set(TEMPLATES.map((t) => t.fixed_cuisine).filter((c): c is string => Boolean(c)))];

export default async function OnboardingPage() {
  const db = await createClient();
  if ((await getOnboardingState(db)).hasActiveBusiness) redirect("/app");
  const places = await listLocalPlaces(db, CITY, STATE);
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 md:px-8 md:py-16">
      <h1 className="mb-8 font-display text-display font-semibold">Add your business</h1>
      <Onboarding
        places={places}
        cuisines={cuisines}
        actions={{ readSite: readSiteAction, findCompetitors: findCompetitorsAction, finish: finishAction }}
      />
    </main>
  );
}
