import "server-only";
import { loadPaidRun } from "@/components/audit/load";
import type { TeamExtras } from "@/components/workspace/team";
import { computeSources } from "@/lib/metrics";
import { listFixes } from "@/lib/queries/fixes";
import { getQuestionsWithLatestAnswers, listRunSummaries } from "@/lib/queries/shell";
import { listDfyBusinesses } from "@/lib/queries/team";
import { getWorkspaceRows, type WorkspaceRows } from "@/lib/queries/workspace";
import { createClient } from "@/lib/supabase/server";
import { addTeamCompetitor, dismissTeamSuggestion, setTeamFixStatus, teamSuggestions } from "./actions";

export type TeamData =
  { kind: "no-clients" } | { kind: "missing" } | { kind: "ok"; rows: WorkspaceRows; extras: TeamExtras };

// One DFY client for /team, read with the team user's own session (RLS, never the service role).
// The brief and the panes count the same runs: complete/partial audit and weekly runs, as /app (Step 8).
export async function loadTeam(picked: string | undefined): Promise<TeamData> {
  const db = await createClient();
  const businesses = await listDfyBusinesses(db);
  if (!businesses.length) return { kind: "no-clients" };
  const business = picked ? businesses.find((b) => b.id === picked) : businesses[0];
  if (!business) return { kind: "missing" };
  const [rows, summaries, questions, fixes] = await Promise.all([
    getWorkspaceRows(db, business.id),
    listRunSummaries(db, business.id, 8, ["complete", "partial"]),
    getQuestionsWithLatestAnswers(db, business.id),
    listFixes(db, business.id),
  ]);
  if (!rows) return { kind: "missing" };
  const latest = summaries[0] ? await loadPaidRun(summaries[0].id) : null;
  return {
    kind: "ok",
    rows,
    extras: {
      businesses: businesses.map(({ id, name }) => ({ id, name })),
      businessId: business.id,
      formAction: "/team",
      input: {
        business,
        metrics: latest?.metrics ?? null,
        sources: questions.run ? computeSources({ questions: questions.questions }) : null,
        fixes,
        questions: questions.questions,
        checks: summaries,
      },
      fixes: { ...fixes, noDomain: !business.domain },
      loadSuggestions: teamSuggestions,
      actions: { status: setTeamFixStatus, add: addTeamCompetitor, dismiss: dismissTeamSuggestion },
    },
  };
}
