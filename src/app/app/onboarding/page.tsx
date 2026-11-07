import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOnboardingState } from "@/lib/queries/onboarding";
import { CUISINES } from "@/lib/onboarding/cuisines";
import { createClient } from "@/lib/supabase/server";
import { Onboarding } from "./Onboarding";
import { findCompetitorsAction, finishAction, placesAction, readHomeAction, readServicesAction } from "./actions";

export const metadata: Metadata = { title: "Add your business - Rank1", robots: { index: false } };

export default async function OnboardingPage() {
  const db = await createClient();
  if ((await getOnboardingState(db)).hasActiveBusiness) redirect("/app");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-16">
      <Onboarding
        cuisines={CUISINES}
        actions={{
          readHome: readHomeAction,
          readServices: readServicesAction,
          places: placesAction,
          findCompetitors: findCompetitorsAction,
          finish: finishAction,
        }}
      />
    </main>
  );
}
