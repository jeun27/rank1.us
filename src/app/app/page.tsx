import type { Metadata } from "next";
import { Dashboard } from "@/components/app/Dashboard";
import { loadShell } from "@/components/app/load";
import { AiReassure } from "@/components/audit/AiAccessPanel";
import { ConnectCard } from "@/components/connections/ConnectCard";
import { loadConnectCard } from "@/components/connections/load";
import { NarrativeDashboard } from "@/components/narrative/NarrativeDashboard";
import { loadDashboardNarrative } from "@/components/narrative/load";
import { getLatestAiAccessCheck } from "@/lib/queries/ai-access";
import { getTopFixes } from "@/lib/queries/shell";

export const metadata: Metadata = { title: "Dashboard - Rank1", robots: { index: false } };

export default async function DashboardPage() {
  const { db, business, latest, series, firstCheck } = await loadShell();
  const now = new Date();
  const ai = process.env.ENABLE_AI_ACCESS_CHECK === "true";
  const [fixes, card, access, narrative] = business
    ? await Promise.all([
        getTopFixes(db, business.id, 1),
        loadConnectCard(db, business.id, now),
        ai ? getLatestAiAccessCheck(db, business.id) : null,
        loadDashboardNarrative(db, business.id),
      ])
    : [[], null, null, null];
  return (
    <Dashboard
      business={business}
      latest={latest}
      series={series ?? { points: [], visible: false }}
      fixes={fixes}
      now={now}
      firstCheck={firstCheck}
      reassure={access && <AiReassure check={access} now={now} />}
      narrative={narrative && <NarrativeDashboard view={narrative} />}
      notice={
        business &&
        card && (
          <ConnectCard {...card} businessId={business.id} returnTo="/app" audience="self" fixesHref="/app/fixes" />
        )
      }
    />
  );
}
