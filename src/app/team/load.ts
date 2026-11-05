import "server-only";
import { storeFor } from "@/app/app/lookup-store";
import { loadPaidRun } from "@/components/audit/load";
import type { TeamExtras } from "@/components/workspace/team";
import { computeSources } from "@/lib/metrics";
import { suggestCompetitors } from "@/lib/onboarding";
import { listFixes } from "@/lib/queries/fixes";
import { getQuestionsWithLatestAnswers, listCompetitors, listRunSummaries } from "@/lib/queries/shell";
import { listDfyBusinesses } from "@/lib/queries/team";
import { getWorkspaceRows, type WorkspaceRows } from "@/lib/queries/workspace";
import { createClient } from "@/lib/supabase/server";
import { addTeamCompetitor, dismissTeamSuggestion, setTeamFixStatus } from "./actions";

export type TeamData =
  { kind: "no-clients" } | { kind: "missing" } | { kind: "ok"; rows: WorkspaceRows; extras: TeamExtras };

// One DFY client for /team, read with the team user's own session (RLS, never the service role).
// The brief and the panes count the same weekly runs as #11's workspace.
export async function loadTeam(picked: string | undefined): Promise<TeamData> {
  const db = await createClient();
  const businesses = await listDfyBusinesses(db);
  if (!businesses.length) return { kind: "no-clients" };
  const business = picked ? businesses.find((b) => b.id === picked) : businesses[0];
  if (!business) return { kind: "missing" };
  const [rows, summaries, questions, fixes, competitors, auth] = await Promise.all([
    getWorkspaceRows(db, business.id),
    listRunSummaries(db, business.id, 8, ["complete", "partial"]),
    getQuestionsWithLatestAnswers(db, business.id),
    listFixes(db, business.id),
    listCompetitors(db, business.id),
    db.auth.getUser(),
  ]);
  if (!rows) return { kind: "missing" };
  const checks = summaries.filter((r) => r.kind === "weekly");
  const latest = checks[0] ? await loadPaidRun(checks[0].id) : null;
  const userId = auth.data.user?.id;
  // Maps through the 24 h cache and the maps_lookup token, as /app does; none without keys or tokens.
  const suggestions = userId
    ? (await suggestCompetitors({ business, ...competitors }, { store: storeFor({ db, userId }) })).items
    : [];
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
        checks,
      },
      fixes: { ...fixes, noDomain: !business.domain },
      suggestions,
      actions: { status: setTeamFixStatus, add: addTeamCompetitor, dismiss: dismissTeamSuggestion },
    },
  };
}
