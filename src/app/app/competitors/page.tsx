import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompetitorsView } from "@/components/app/CompetitorsView";
import { loadShell } from "@/components/app/load";
import { suggestCompetitors } from "@/lib/onboarding";
import { listCompetitors } from "@/lib/queries/shell";
import { storeFor } from "../lookup-store";
import { addCompetitorAction, dismissSuggestionAction } from "./actions";

export const metadata: Metadata = { title: "Competitors - Rank1", robots: { index: false } };

export default async function CompetitorsPage() {
  const { db, business, latest, userId } = await loadShell();
  if (!business || !userId) redirect("/app");
  const { tracked, dismissed } = await listCompetitors(db, business.id);
  // Maps through the 24 h cache and the maps_lookup token; no keys or over the limit → none shown.
  const { items } = await suggestCompetitors({ business, tracked, dismissed }, { store: storeFor({ db, userId }) });
  return (
    <CompetitorsView
      latest={latest}
      tracked={tracked}
      suggestions={items}
      actions={{ add: addCompetitorAction, dismiss: dismissSuggestionAction }}
      now={new Date()}
    />
  );
}
