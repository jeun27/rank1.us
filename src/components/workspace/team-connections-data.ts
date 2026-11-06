import type { HubConnection } from "@/components/connections/ConnectionsHub";
import type { Json } from "@/types/db";
import type { ConnectionChange, ConnectorKey } from "@/lib/queries/connections";

// C-c: what the team's Connections document shows for one DFY client (read with the team's own session).
export type TeamChange = {
  id: string;
  connectionId: string;
  field: string;
  before: Json | null;
  after: Json | null;
  // #160 S1: who the actor is. A current client user shows their email (the team UI only).
  by: { kind: "team" } | { kind: "client"; email: string } | { kind: "former" };
  at: string;
};
export type TeamConnectionsData = {
  business: string;
  gas: { readyAt: string | null; showNotice: boolean } | null;
  connections: HubConnection[];
  changes: TeamChange[];
  interest: ConnectorKey[];
};

// #160 S1: by who the actor is, never by "not a current client user". teamChangeIds = the changes whose actor
// is on the Rank1 team (backend's connection_change_actors); then a current client user; else a former user.
export function toTeamChanges(
  rows: ConnectionChange[],
  clients: { user_id: string; email: string }[],
  teamChangeIds: Set<string>,
): TeamChange[] {
  const email = new Map(clients.map((u) => [u.user_id, u.email]));
  const who = (r: ConnectionChange): TeamChange["by"] => {
    if (teamChangeIds.has(r.id)) return { kind: "team" };
    const e = email.get(r.actor);
    return e ? { kind: "client", email: e } : { kind: "former" };
  };
  return rows.map((r) => ({
    id: r.id,
    connectionId: r.connection_id,
    field: r.field,
    before: r.before,
    after: r.after,
    by: who(r),
    at: r.created_at,
  }));
}
