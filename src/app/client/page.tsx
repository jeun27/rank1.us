import type { Metadata } from "next";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { loadClient } from "./load";

export const metadata: Metadata = { title: "Dashboard - Rank1", robots: { index: false } };

// Step 12: the done-for-you client view (read-only).
export default async function ClientPage() {
  const data = await loadClient();
  return <ClientDashboard {...data} now={new Date()} />;
}
