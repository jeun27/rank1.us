import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/auth/AppHeader";
import { AreaGate } from "@/components/auth/AreaGate";
import { Placeholder } from "@/components/auth/Placeholder";
import { NoClients } from "@/components/workspace/NoClients";
import { Workspace } from "@/components/workspace/Workspace";
import { buildWorkspace } from "@/lib/queries/workspace";
import { loadTeam } from "./load";

export const metadata: Metadata = { title: "Rank1", robots: { index: false } };

// The team workspace on real DFY data, off unless ENABLE_TEAM_WORKSPACE=true (Production stays false).
// An unknown ?b= is a 404 in the proxy first; notFound() here is the fallback.
export async function TeamView({ client }: { client?: string }) {
  if (process.env.ENABLE_TEAM_WORKSPACE !== "true")
    return (
      <>
        <AppHeader />
        <Placeholder title="Dashboard" />
      </>
    );
  const data = await loadTeam(client);
  if (data.kind === "missing") notFound();
  if (data.kind === "no-clients")
    return (
      <>
        <AppHeader />
        <NoClients />
      </>
    );
  return (
    <>
      <Workspace view={buildWorkspace(data.rows)} team={data.extras} />
    </>
  );
}

async function Client({ searchParams }: Pick<PageProps<"/team">, "searchParams">) {
  const b = (await searchParams).b;
  return <TeamView client={typeof b === "string" && b ? b : undefined} />;
}

export default function TeamPage({ searchParams }: PageProps<"/team">) {
  return (
    <Suspense>
      <AreaGate area="/team">
        <Client searchParams={searchParams} />
      </AreaGate>
    </Suspense>
  );
}
