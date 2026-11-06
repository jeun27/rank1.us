import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { selectedBusinessId } from "@/app/app/current";
import { ConnectCard } from "@/components/connections/ConnectCard";
import { connectionsCopy as c } from "@/components/connections/copy";
import { loadConnectCard } from "@/components/connections/load";
import { Banner } from "@/components/ui/Banner";
import type { GoogleConnector } from "@/lib/connections/oauth";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connect your accounts - Rank1", robots: { index: false } };

const RETURN = "/app/onboarding/connect";

// C-b: right after Finish setup, the Recommended connections only. Behind ENABLE_CONNECTIONS (proxy 404).
// Nothing to connect (e.g. vertical "other") goes on to the dashboard.
export default async function ConnectStepPage({ searchParams }: PageProps<"/app/onboarding/connect">) {
  await connection();
  const db = await createClient();
  const business = await getCurrentBusiness(db, await selectedBusinessId());
  if (!business) redirect("/app/onboarding");
  const card = await loadConnectCard(db, business.id, new Date(), true);
  if (!card) redirect("/app");
  const { status, connection: connector } = await searchParams;
  const name = c.names[(typeof connector === "string" ? connector : "gbp") as GoogleConnector] ?? c.names.gbp;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10 md:px-8 md:py-16">
      <h1 className="font-display text-display font-semibold">Add your business</h1>
      {status === "connected" && <Banner tone="info">{c.outcomes.connected(name)}</Banner>}
      {status === "denied" && <Banner tone="info">{c.outcomes.denied}</Banner>}
      {typeof status === "string" && status !== "connected" && status !== "denied" && (
        <Banner tone="error">{c.outcomes.error}</Banner>
      )}
      <ConnectCard {...card} businessId={business.id} returnTo={RETURN} audience="self" skipHref="/app" />
    </main>
  );
}
