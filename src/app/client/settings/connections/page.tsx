import type { Metadata } from "next";
import { connection } from "next/server";
import { Page } from "@/components/app/Page";
import { ConnectionsHub } from "@/components/connections/ConnectionsHub";
import { connectionsCopy as c } from "@/components/connections/copy";
import { hubActions } from "@/components/connections/hub-actions";
import { loadHub } from "@/components/connections/load";
import { listDfyBusinesses } from "@/lib/queries/team";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connections - Rank1", robots: { index: false } };

// The DFY client's own business: the one place a dfy_client writes, authorizing its connections (OAuth only).
export default async function ClientConnectionsPage({ searchParams }: PageProps<"/client/settings/connections">) {
  await connection();
  const db = await createClient();
  const [business] = await listDfyBusinesses(db);
  if (!business) return <Page title={c.title}>{null}</Page>;
  const hub = await loadHub(db, business.id, "/client/settings/connections", await searchParams);
  return (
    <Page title={c.title}>
      <ConnectionsHub {...hub} actions={hubActions(business.id)} />
    </Page>
  );
}
