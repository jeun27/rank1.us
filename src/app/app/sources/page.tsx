import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { SourcesView } from "@/components/app/SourcesView";
import { computeSources } from "@/lib/metrics";
import { getQuestionsWithLatestAnswers } from "@/lib/queries/shell";

export const metadata: Metadata = { title: "Sources - Rank1", robots: { index: false } };

// The latest complete/partial run's cited links (Step 8's "latest"), optionally for one target location.
export default async function SourcesPage({ searchParams }: PageProps<"/app/sources">) {
  const { db, business } = await loadShell();
  if (!business) redirect("/app");
  const { run, questions } = await getQuestionsWithLatestAnswers(db, business.id);
  const raw = (await searchParams).location;
  const location = typeof raw === "string" && raw ? raw : undefined;
  return <SourcesView sources={run ? computeSources({ questions, location }) : null} location={location} />;
}
