import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { QuestionsView } from "@/components/app/QuestionsView";
import { getQuestionsWithLatestAnswers } from "@/lib/queries/shell";

export const metadata: Metadata = { title: "Questions - Rank1", robots: { index: false } };

export default async function QuestionsPage() {
  const { db, business } = await loadShell();
  if (!business) redirect("/app");
  return <QuestionsView data={await getQuestionsWithLatestAnswers(db, business.id)} />;
}
