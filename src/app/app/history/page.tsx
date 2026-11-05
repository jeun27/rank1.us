import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HistoryView } from "@/components/app/HistoryView";
import { loadShell } from "@/components/app/load";
import { listRunSummaries } from "@/lib/queries/shell";

export const metadata: Metadata = { title: "History - Rank1", robots: { index: false } };

// Every audit/weekly run (complete, partial or failed), newest first.
export default async function HistoryPage() {
  const { db, business } = await loadShell();
  if (!business) redirect("/app");
  return <HistoryView runs={await listRunSummaries(db, business.id, 104)} />;
}
