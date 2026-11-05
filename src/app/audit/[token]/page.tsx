import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuditView } from "@/components/audit/AuditView";
import { AutoRefresh } from "@/components/audit/AutoRefresh";
import { loadFreeAudit } from "@/components/audit/load";

// The token is the only key: never indexed, never followed (headers also send no-referrer).
export const metadata: Metadata = { title: "Your free audit - Rank1", robots: { index: false, follow: false } };

export default function FreeAuditPage({ params }: PageProps<"/audit/[token]">) {
  return (
    <Suspense>
      <FreeAudit params={params} />
    </Suspense>
  );
}

async function FreeAudit({ params }: Pick<PageProps<"/audit/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const loaded = await loadFreeAudit(token);
  if (!loaded) notFound();
  const { status } = loaded.results.run;
  return (
    <>
      <AutoRefresh active={status === "queued" || status === "running"} />
      <AuditView {...loaded} free exportBase={`/audit/${encodeURIComponent(token)}`} now={new Date()} />
    </>
  );
}
