import type { Metadata } from "next";
import { Dashboard } from "@/components/app/Dashboard";
import { loadShell } from "@/components/app/load";
import { ConnectCard } from "@/components/connections/ConnectCard";
import { loadConnectCard } from "@/components/connections/load";
import { getTopFixes } from "@/lib/queries/shell";

export const metadata: Metadata = { title: "Dashboard - Rank1", robots: { index: false } };

export default async function DashboardPage() {
  const { db, business, latest, series } = await loadShell();
  const now = new Date();
  const [fixes, card] = business
    ? await Promise.all([getTopFixes(db, business.id, 1), loadConnectCard(db, business.id, now)])
    : [[], null];
  return (
    <Dashboard
      business={business}
      latest={latest}
      series={series ?? { points: [], visible: false }}
      fixes={fixes}
      now={now}
      notice={
        business &&
        card && (
          <ConnectCard {...card} businessId={business.id} returnTo="/app" audience="self" fixesHref="/app/fixes" />
        )
      }
    />
  );
}
