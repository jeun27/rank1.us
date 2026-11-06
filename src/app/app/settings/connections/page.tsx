import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { Page } from "@/components/app/Page";
import { ConnectionsHub } from "@/components/connections/ConnectionsHub";
import { connectionsCopy as c } from "@/components/connections/copy";
import { hubActions } from "@/components/connections/hub-actions";
import { loadHub } from "@/components/connections/load";

export const metadata: Metadata = { title: "Connections - Rank1", robots: { index: false } };

// Settings → Connections for the current self-serve business (C-a). Behind ENABLE_CONNECTIONS (proxy 404).
export default async function ConnectionsPage({ searchParams }: PageProps<"/app/settings/connections">) {
  const { db, business } = await loadShell();
  if (!business) redirect("/app");
  const hub = await loadHub(db, business.id, "/app/settings/connections", await searchParams);
  return (
    <Page title={c.title}>
      <ConnectionsHub {...hub} actions={hubActions(business.id)} />
    </Page>
  );
}
