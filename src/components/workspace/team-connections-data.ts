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
  // A client user's email (the team UI only), or null for the Rank1 team.
  by: string | null;
  at: string;
};
export type TeamConnectionsData = {
  business: string;
  gas: { readyAt: string | null; showNotice: boolean } | null;
  connections: HubConnection[];
  changes: TeamChange[];
  interest: ConnectorKey[];
};

// Only the team applies DFY edits; a client user's own change (e.g. a revoke) shows their email.
export function toTeamChanges(rows: ConnectionChange[], clients: { user_id: string; email: string }[]): TeamChange[] {
  const email = new Map(clients.map((u) => [u.user_id, u.email]));
  return rows.map((r) => ({
    id: r.id,
    connectionId: r.connection_id,
    field: r.field,
    before: r.before,
    after: r.after,
    by: email.get(r.actor) ?? null,
    at: r.created_at,
  }));
}
