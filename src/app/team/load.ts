import "server-only";
import { loadPaidRun } from "@/components/audit/load";
import type { TeamExtras } from "@/components/workspace/team";
import { computeSources } from "@/lib/metrics";
import { listDoneFixes, listFixes } from "@/lib/queries/fixes";
import { getQuestionsWithLatestAnswers, listRunSummaries } from "@/lib/queries/shell";
import { listClientUsers } from "@/lib/queries/clients";
import { listDfyBusinesses } from "@/lib/queries/team";
import {
  listConnectionChangeActors,
  listConnectionChanges,
  listConnections,
  listConnectorInterest,
} from "@/lib/queries/connections";
import { getGasReady } from "@/lib/queries/gas-ready";
import { loadMentions } from "@/lib/mentions/service";
import { loadNarrative } from "@/lib/narrative/service";
import { toTeamChanges } from "@/components/workspace/team-connections-data";
import { getWorkspaceRows, type WorkspaceRows } from "@/lib/queries/workspace";
import { createClient } from "@/lib/supabase/server";
import { loadQueue } from "./queue";
import {
  addTeamCompetitor,
  decideTeamMention,
  dismissTeamReady,
  saveTeamNarrativeWords,
  dismissTeamSuggestion,
  inviteTeamClient,
  removeTeamClient,
  setTeamFixListVisible,
  setTeamFixStatus,
  teamSuggestions,
} from "./actions";

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
  const [rows, summaries, questions, fixes, clientUsers, done, queue] = await Promise.all([
    getWorkspaceRows(db, business.id),
    listRunSummaries(db, business.id, 8, ["complete", "partial"]),
    getQuestionsWithLatestAnswers(db, business.id),
    listFixes(db, business.id),
    listClientUsers(db, business.id),
    listDoneFixes(db, business.id),
    loadQueue(db, businesses),
  ]);
  if (!rows) return { kind: "missing" };
  // C-c: the client's Connections document, only with ENABLE_CONNECTIONS (stored data, no provider calls).
  const connectionsOn = process.env.ENABLE_CONNECTIONS === "true";
  // C-c D3/D4: the client's narrative words and G7 lists ("disabled" without ENABLE_NARRATIVE / ENABLE_MENTIONS).
  const [latest, conns, changes, actors, interest, gas, narrative, mentions] = await Promise.all([
    summaries[0] ? loadPaidRun(summaries[0].id) : null,
    connectionsOn ? listConnections(db, business.id) : [],
    connectionsOn ? listConnectionChanges(db, business.id, 50) : [],
    connectionsOn ? listConnectionChangeActors(db, business.id) : [],
    connectionsOn ? listConnectorInterest(db, business.id) : [],
    connectionsOn ? getGasReady(db, business.id) : null,
    loadNarrative(db, business.id),
    loadMentions(db, business.id),
  ]);
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
      fixes: { ...fixes, done, noDomain: !business.domain },
      loadSuggestions: teamSuggestions,
      queue,
      openQueue: !picked,
      // Emails reach the team UI only; never logged.
      clients: {
        users: clientUsers.map(({ user_id, email }) => ({ user_id, email })),
        fixListVisible: business.fix_list_visible,
      },
      connections: connectionsOn
        ? {
            business: business.name,
            gas,
            connections: conns.map((c) => ({
              id: c.id,
              provider: c.provider,
              status: c.status,
              selected: c.selected_entities,
            })),
            changes: toTeamChanges(
              changes,
              clientUsers,
              new Set(actors.filter((a) => a.actor_is_team).map((a) => a.change_id)),
            ),
            interest: [...new Set(interest.map((i) => i.provider))],
          }
        : null,
      narrative: narrative === "disabled" ? null : narrative,
      mentions:
        mentions === "disabled"
          ? null
          : { targets: mentions, fixId: fixes.ranked.find((f) => f.rule_key === "R17")?.id ?? null },
      actions: {
        status: setTeamFixStatus,
        add: addTeamCompetitor,
        dismiss: dismissTeamSuggestion,
        invite: inviteTeamClient,
        removeClient: removeTeamClient,
        setFixListVisible: setTeamFixListVisible,
        dismissReady: dismissTeamReady,
        saveNarrative: saveTeamNarrativeWords,
        decideMention: decideTeamMention,
      },
    },
  };
}
