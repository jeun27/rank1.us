import type { Json } from "@/types/db";
import type { DbClient } from "./client";

// Connections (0021). Reads use the caller's client (RLS: the business's members, incl. its
// dfy_client, and the team on DFY). Writes are service-client RPCs, called by a server route only
// after canConnectBusiness / canApplyEdits pass on the user's client. Tokens are ciphertext only.

// One list, shared with src/lib/connections/recommend.ts.
export const CONNECTOR_KEYS = [
  "gbp",
  "apple_business_connect",
  "bing_places",
  "yelp",
  "opentable",
  "resy",
  "site_cms",
  "shopify",
  "amazon",
  "g2_capterra",
  "search_console",
  "ga4",
  "youtube",
] as const;
export type ConnectorKey = (typeof CONNECTOR_KEYS)[number];

// Providers that can hold a connection. gbp, search_console, ga4 and youtube share one Google grant.
export type ConnectionProvider = "gbp" | "search_console" | "ga4" | "shopify" | "youtube";
export type ConnectionStatus = "connected" | "needs_reauth" | "revoked";

// The only Business Profile fields a DFY edit may change (the DB refuses others).
export const GBP_EDIT_FIELDS = [
  "description",
  "regular_hours",
  "special_hours",
  "website_uri",
  "primary_phone",
  "attributes",
] as const;

export type ConnectionEntity = { id: string; name: string };

export type ConnectionRow = {
  id: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  external_account_id: string | null;
  selected_entities: ConnectionEntity[];
  scopes: string[];
  connected_at: string;
  last_checked_at: string | null;
};

export async function listConnections(db: DbClient, businessId: string): Promise<ConnectionRow[]> {
  const { data, error } = await db
    .from("connections")
    .select("id, provider, status, external_account_id, selected_entities, scopes, connected_at, last_checked_at")
    .eq("business_id", businessId)
    .order("provider");
  if (error) throw error;
  return data.map((c) => ({
    ...c,
    provider: c.provider as ConnectionProvider,
    status: c.status as ConnectionStatus,
    selected_entities: c.selected_entities as unknown as ConnectionEntity[],
  }));
}

export type ConnectionChange = {
  id: string;
  connection_id: string;
  actor: string;
  field: string;
  before: Json | null;
  after: Json | null;
  provider_ref: string | null;
  created_at: string;
};

// Newest first.
export async function listConnectionChanges(
  db: DbClient,
  businessId: string,
  limit = 100,
): Promise<ConnectionChange[]> {
  const { data, error } = await db
    .from("connection_changes")
    .select("id, connection_id, actor, field, before, after, provider_ref, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw error;
  return data;
}

export type ConnectorInterest = { provider: ConnectorKey; user_id: string; created_at: string };

export async function listConnectorInterest(db: DbClient, businessId: string): Promise<ConnectorInterest[]> {
  const { data, error } = await db
    .from("connector_interest")
    .select("provider, user_id, created_at")
    .eq("business_id", businessId)
    .order("created_at");
  if (error) throw error;
  return data.map((r) => ({ ...r, provider: r.provider as ConnectorKey }));
}

// The business's own members (incl. its dfy_client) connect and revoke; never the team.
export async function canConnectBusiness(db: DbClient, businessId: string): Promise<boolean> {
  const { data, error } = await db.rpc("can_connect_business", { p_business_id: businessId });
  if (error) throw error;
  return data;
}

// Self-serve members, or the team on DFY. Never a dfy_client.
export async function canApplyEdits(db: DbClient, businessId: string): Promise<boolean> {
  const { data, error } = await db.rpc("can_apply_edits", { p_business_id: businessId });
  if (error) throw error;
  return data;
}

// "Notify me" on a Coming soon tile. Idempotent. Errors: 22023 unknown connector, 42501 not allowed.
export async function noteConnectorInterest(db: DbClient, businessId: string, provider: ConnectorKey): Promise<void> {
  const { error } = await db.rpc("note_connector_interest", { p_business_id: businessId, p_provider: provider });
  if (error) throw error;
}

// Service client only from here on. 42501 for any other caller.

// Connects or reconnects. A Google grant is one business + one Google account (externalAccountId,
// the Google sub): its live gbp/search_console/ga4 connections share the tokens. A null
// encRefresh keeps the grant's stored refresh token.
export async function saveConnection(
  serviceDb: DbClient,
  c: {
    businessId: string;
    provider: ConnectionProvider;
    externalAccountId: string | null;
    scopes: string[];
    connectedBy: string;
    encAccess: string;
    encRefresh: string | null;
    expiresAt: string | null;
  },
): Promise<string> {
  const { data, error } = await serviceDb.rpc("save_connection", {
    p_business_id: c.businessId,
    p_provider: c.provider,
    p_external_account_id: c.externalAccountId as string,
    p_scopes: c.scopes,
    p_connected_by: c.connectedBy,
    p_enc_access: c.encAccess,
    p_enc_refresh: c.encRefresh as string,
    p_expires_at: c.expiresAt as string,
  });
  if (error) throw error;
  return data;
}

export type ConnectionTokens = {
  enc_access: string | null;
  enc_refresh: string | null;
  expires_at: string | null;
  status: "connected" | "needs_reauth";
  external_account_id: string | null;
};

// Null when the connection is revoked or has no tokens.
export async function getConnectionTokens(serviceDb: DbClient, connectionId: string): Promise<ConnectionTokens | null> {
  const { data, error } = await serviceDb.rpc("get_connection_tokens", { p_connection_id: connectionId });
  if (error) throw error;
  const row = data[0];
  return row ? { ...row, status: row.status as ConnectionTokens["status"] } : null;
}

// After a refresh, grant-wide. The stored refresh token is kept unless encRefresh is given.
export async function updateConnectionTokens(
  serviceDb: DbClient,
  connectionId: string,
  t: { encAccess: string; expiresAt: string | null; encRefresh?: string },
): Promise<void> {
  const { error } = await serviceDb.rpc("update_connection_tokens", {
    p_connection_id: connectionId,
    p_enc_access: t.encAccess,
    p_expires_at: t.expiresAt as string,
    p_enc_refresh: t.encRefresh,
  });
  if (error) throw error;
}

// At most 100 picked locations/stores. 22023 otherwise.
export async function setConnectionEntities(
  serviceDb: DbClient,
  connectionId: string,
  entities: ConnectionEntity[],
): Promise<void> {
  const { error } = await serviceDb.rpc("set_connection_entities", {
    p_connection_id: connectionId,
    p_entities: entities as unknown as Json,
  });
  if (error) throw error;
}

// needs_reauth after a 401/invalid_grant (grant-wide for Google). Never un-revokes.
export async function setConnectionStatus(
  serviceDb: DbClient,
  connectionId: string,
  status: "connected" | "needs_reauth",
): Promise<void> {
  const { error } = await serviceDb.rpc("set_connection_status", { p_connection_id: connectionId, p_status: status });
  if (error) throw error;
}

// After revoking with the provider: revoked and tokens deleted, the whole grant for Google.
// Returns the newly revoked ids.
export async function revokeConnection(serviceDb: DbClient, connectionId: string): Promise<string[]> {
  const { data, error } = await serviceDb.rpc("revoke_connection", { p_connection_id: connectionId });
  if (error) throw error;
  return data;
}

// Appends one applied DFY edit. For gbp, field is one of GBP_EDIT_FIELDS (22023 otherwise).
export async function recordConnectionChange(
  serviceDb: DbClient,
  c: {
    connectionId: string;
    actor: string;
    field: string;
    before: Json | null;
    after: Json | null;
    providerRef?: string;
  },
): Promise<string> {
  const { data, error } = await serviceDb.rpc("record_connection_change", {
    p_connection_id: c.connectionId,
    p_actor: c.actor,
    p_field: c.field,
    p_before: c.before as Json,
    p_after: c.after as Json,
    p_provider_ref: (c.providerRef ?? null) as string,
  });
  if (error) throw error;
  return data;
}

// The business's industry (businesses.vertical) for recommend(). Null when the caller can't read it.
export async function getBusinessVertical(db: DbClient, businessId: string): Promise<string | null> {
  const { data, error } = await db.from("businesses").select("vertical").eq("id", businessId).maybeSingle();
  if (error) throw error;
  return data?.vertical ?? null;
}

// For the change log: whether each change was made by the Rank1 team (frontend shows "by Rank1 team",
// a current client user's email from listClientUsers, or "by a former user"). Same visibility as
// listConnectionChanges; empty for anyone else. Only the flag, never a name or email.
export async function listConnectionChangeActors(
  db: DbClient,
  businessId: string,
): Promise<{ change_id: string; actor_is_team: boolean }[]> {
  const { data, error } = await db.rpc("connection_change_actors", { p_business_id: businessId });
  if (error) throw error;
  return data;
}
