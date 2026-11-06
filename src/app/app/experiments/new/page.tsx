import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { Page } from "@/components/app/Page";
import { ExperimentForm } from "@/components/experiments/ExperimentForm";
import { experimentCopy as c } from "@/components/experiments/copy";
import { laToday } from "@/lib/queries/experiments";
import { listFixes } from "@/lib/queries/fixes";
import { listQuestionsByBusiness } from "@/lib/queries/questions";
import { createExperimentAction } from "../actions";

export const metadata: Metadata = { title: "Start a test - Rank1", robots: { index: false } };

// 'Start a test' (Step 17), also from a fix (?fix=<id>): the name defaults to the fix title.
export default async function NewExperimentPage({ searchParams }: PageProps<"/app/experiments/new">) {
  const { db, business } = await loadShell();
  if (!business) redirect("/app");
  const raw = (await searchParams).fix;
  const fixId = typeof raw === "string" && raw ? raw : null;
  const [questions, fixes] = await Promise.all([
    listQuestionsByBusiness(db, business.id),
    fixId ? listFixes(db, business.id) : null,
  ]);
  const fix = fixes ? [...fixes.ranked, ...fixes.tidyUps].find((f) => f.id === fixId) : undefined;
  return (
    <Page title={c.start}>
      <ExperimentForm
        questions={questions.filter((q) => q.active).map((q) => ({ id: q.id, text: q.short_text }))}
        today={laToday()}
        fix={fix ? { id: fix.id, title: fix.title } : null}
        onCreate={createExperimentAction}
      />
    </Page>
  );
}
