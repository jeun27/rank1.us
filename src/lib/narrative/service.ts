import "server-only";
import { matchNarrative, type NarrativeResult } from "@/lib/metrics/narrative";
import type { DbClient } from "@/lib/queries/client";
import { getNarrativeWords, type NarrativeWords } from "@/lib/queries/narrative";
import { getQuestionsWithLatestAnswers } from "@/lib/queries/shell";

// G4 for the dashboard card and Settings, behind ENABLE_NARRATIVE. Reads with the caller's client (RLS):
// the word lists, the business name + aliases, and the latest answer per question and engine (the same
// answers the Questions page shows). result is null until there are words and a finished run.
export const narrativeEnabled = (env: Record<string, string | undefined> = process.env) =>
  env.ENABLE_NARRATIVE === "true";

export type NarrativeView = { words: NarrativeWords; checkedAt: string | null; result: NarrativeResult | null };

export async function loadNarrative(
  db: DbClient,
  businessId: string,
  env: Record<string, string | undefined> = process.env,
): Promise<NarrativeView | null | "disabled"> {
  if (!narrativeEnabled(env)) return "disabled";
  const [words, biz] = await Promise.all([
    getNarrativeWords(db, businessId),
    db.from("businesses").select("name, aliases").eq("id", businessId).maybeSingle(),
  ]);
  if (biz.error) throw biz.error;
  if (!words || !biz.data) return null;
  if (!words.want.length && !words.avoid.length) return { words, checkedAt: null, result: null };
  const latest = await getQuestionsWithLatestAnswers(db, businessId);
  if (!latest.run) return { words, checkedAt: null, result: null };
  const answers = latest.questions.flatMap((q) =>
    q.answers.map((a) => ({
      key: `${q.id}:${a.engine}:${a.run_index}`,
      status: a.status,
      mentioned: a.mentioned,
      text: a.text,
    })),
  );
  const names = [biz.data.name, ...(biz.data.aliases ?? [])];
  return { words, checkedAt: latest.run.finished_at, result: matchNarrative({ names, words, answers }) };
}
