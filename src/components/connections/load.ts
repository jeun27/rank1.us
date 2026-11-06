import "server-only";
import { INDUSTRIES, type Industry } from "@/lib/connections/recommend";
import {
  canConnectBusiness,
  getBusinessVertical,
  listConnectionChanges,
  listConnections,
  listConnectorInterest,
} from "@/lib/queries/connections";
import type { DbClient } from "@/lib/queries/client";
import type { HubProps } from "./ConnectionsHub";

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

// Everything the hub shows for one business, read with the caller's client (RLS). Actions are added by the page.
export async function loadHub(
  db: DbClient,
  businessId: string,
  returnTo: string,
  params: Record<string, string | string[] | undefined>,
): Promise<Omit<HubProps, "actions">> {
  const [vertical, connections, interest, changes, canConnect] = await Promise.all([
    getBusinessVertical(db, businessId),
    listConnections(db, businessId),
    listConnectorInterest(db, businessId),
    listConnectionChanges(db, businessId, 20),
    canConnectBusiness(db, businessId),
  ]);
  const status = one(params.status);
  return {
    businessId,
    industry: (INDUSTRIES as readonly string[]).includes(vertical ?? "") ? (vertical as Industry) : "other",
    connections: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      status: c.status,
      selected: c.selected_entities,
    })),
    interest: [...new Set(interest.map((i) => i.provider))],
    changes: changes.map((x) => ({ id: x.id, connectionId: x.connection_id, field: x.field, at: x.created_at })),
    canConnect,
    returnTo,
    outcome: status ? { connector: one(params.connection), status } : null,
  };
}
