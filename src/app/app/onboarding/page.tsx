import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOnboardingState } from "@/lib/queries/onboarding";
import { listLocalPlaces } from "@/lib/queries/places";
import { CUISINES } from "@/lib/onboarding/cuisines";
import { createClient } from "@/lib/supabase/server";
import { Onboarding } from "./Onboarding";
import { findCompetitorsAction, finishAction, readHomeAction, readServicesAction } from "./actions";

export const metadata: Metadata = { title: "Add your business - Rank1", robots: { index: false } };

// First area: Irvine, CA (docs/PRODUCT.md).
const CITY = "Irvine";
const STATE = "CA";

export default async function OnboardingPage() {
  const db = await createClient();
  if ((await getOnboardingState(db)).hasActiveBusiness) redirect("/app");
  const places = await listLocalPlaces(db, CITY, STATE);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-16">
      {/* OB2: the app title size (Page's 22/28 gradient), not the landing's display size. */}
      <h1 className="heading-gradient mb-8 font-display text-title font-semibold tracking-[-0.02em]">
        Add your business
      </h1>
      <Onboarding
        places={places}
        cuisines={CUISINES}
        actions={{
          readHome: readHomeAction,
          readServices: readServicesAction,
          findCompetitors: findCompetitorsAction,
          finish: finishAction,
        }}
        verticals={process.env.ENABLE_CONNECTIONS === "true"}
      />
    </main>
  );
}
