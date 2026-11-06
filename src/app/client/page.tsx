import type { Metadata } from "next";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { ConnectCard } from "@/components/connections/ConnectCard";
import { loadClient } from "./load";

export const metadata: Metadata = { title: "Dashboard - Rank1", robots: { index: false } };

// Step 12: the done-for-you client view (read-only). C-b: the connect card, the one thing a client acts on.
export default async function ClientPage() {
  const { card, ...data } = await loadClient();
  return (
    <ClientDashboard
      {...data}
      now={new Date()}
      notice={
        data.business &&
        card && <ConnectCard {...card} businessId={data.business.id} returnTo="/client" audience="dfy" />
      }
    />
  );
}
