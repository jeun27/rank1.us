import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { SourcesView } from "@/components/app/SourcesView";
import { MentionsSection } from "@/components/mentions/MentionsSection";
import { loadMentions, mentionsEnabled } from "@/lib/mentions/service";
import { computeSources, locationKey } from "@/lib/metrics";
import { listFixes } from "@/lib/queries/fixes";
import { getQuestionsWithLatestAnswers } from "@/lib/queries/shell";
import { decideMentionAction } from "./actions";

export const metadata: Metadata = { title: "Sources - Rank1", robots: { index: false } };

// The latest complete/partial run's cited links (Step 8's "latest"), optionally for one target location.
export default async function SourcesPage({ searchParams }: PageProps<"/app/sources">) {
  const { db, business } = await loadShell();
  if (!business) redirect("/app");
  const g7 = mentionsEnabled();
  const [{ run, questions }, targets, fixes] = await Promise.all([
    getQuestionsWithLatestAnswers(db, business.id),
    g7 ? loadMentions(db, business.id) : null,
    g7 ? listFixes(db, business.id) : null,
  ]);
  const raw = (await searchParams).location;
  const location = typeof raw === "string" && raw ? raw : undefined;
  // n for the freshness line: ok answers of the questions in view (rule 3).
  const answers = questions
    .filter((q) => !location || locationKey(q) === location)
    .reduce((n, q) => n + q.answers.filter((a) => a.status === "ok").length, 0);
  return (
    <SourcesView
      sources={run ? computeSources({ questions, location }) : null}
      location={location}
      checkedAt={run?.finished_at ?? null}
      answers={answers}
      now={new Date()}
      mentions={
        g7 &&
        targets !== "disabled" && (
          <MentionsSection
            targets={targets}
            canDecide
            fixId={fixes?.ranked.find((f) => f.rule_key === "R17")?.id ?? null}
            decide={decideMentionAction}
          />
        )
      }
    />
  );
}
