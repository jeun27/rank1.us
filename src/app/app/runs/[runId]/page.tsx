import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AuditView } from "@/components/audit/AuditView";
import { AutoRefresh } from "@/components/audit/AutoRefresh";
import { loadPaidRun } from "@/components/audit/load";

export const metadata: Metadata = { title: "Audit results - Rank1", robots: { index: false, follow: false } };

// Members only: /app's AreaGate signs people in, and RLS returns nothing for another workspace's run.
export default async function RunPage({ params }: PageProps<"/app/runs/[runId]">) {
  await connection();
  const { runId } = await params;
  const loaded = await loadPaidRun(runId);
  if (!loaded) notFound();
  const { status } = loaded.results.run;
  return (
    <>
      <AutoRefresh active={status === "queued" || status === "running"} />
      <AuditView {...loaded} free={false} exportBase={`/app/runs/${runId}`} now={new Date()} />
    </>
  );
}
