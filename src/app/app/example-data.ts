// Example data: the Example Ramen House seed (supabase/seed.sql), as the rows getWorkspaceRows would read.
// /app shows this read-only until sign-in exists.
import type { WorkspaceRows } from "@/lib/queries/workspace";
import { BUSINESS, COMPETITORS, IDS, seedRows } from "../../../scripts/seed/data";

export function exampleWorkspaceRows(): WorkspaceRows {
  const { questions, runs, answers, citations } = seedRows();
  return {
    business: { id: IDS.business, name: BUSINESS, city: "Irvine", state: "CA" },
    competitors: COMPETITORS.map((name) => ({ name })),
    questions: questions.map((q) => ({ id: q.id, short_text: q.short_text })),
    runs: runs.map((r) => ({ id: r.id, started_at: r.started_at, finished_at: r.finished_at })),
    answers: answers.map((a) => ({
      ...a,
      location_supported: a.engine === "google_aio" || a.engine === "perplexity" ? "exact" : "fallback_country",
    })),
    citations: citations.map(({ answer_id, url, domain, title }) => ({ answer_id, url, domain, title })),
  };
}
