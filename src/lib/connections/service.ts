import "server-only";
import type { DbClient } from "@/lib/queries/client";
import {
  canApplyEdits,
  canConnectBusiness,
  getConnectionTokens,
  recordConnectionChange,
  revokeConnection,
  saveConnection,
  setConnectionEntities,
  setConnectionStatus,
  updateConnectionTokens,
  type ConnectionEntity,
} from "@/lib/queries/connections";
import type { Json } from "@/types/db";
import { decryptToken, encryptToken, tokenKey, TokenKeyError } from "./crypto";
import { listGa4Properties } from "./ga4";
import { applyEdits, diffLocation, EditNotAllowed, listAccounts, listLocations, readLocation, stable } from "./gbp";
import type { Change, GbpEdit } from "./gbp";
import { GoogleApiError } from "./google-api";
import {
  DEFAULT_RETURN,
  exchangeCode,
  OAuthError,
  readState,
  refreshAccessToken,
  revokeGrant,
  startAuth,
  type GoogleConnector,
} from "./oauth";
import { listSites } from "./search-console";
import { ConnectionError, withGoogleToken, type TokenDeps } from "./tokens";

// Connections (behind ENABLE_CONNECTIONS). Every entry point checks the flag, then the caller's access
// with their own client (can_connect_business / can_apply_edits), and only then uses the service client.
// Logs carry the connector and outcome only: never a code, state, token, Google sub or email.
type Env = Record<string, string | undefined>;
export type Ctx = {
  userDb: DbClient;
  serviceDb: DbClient;
  env?: Env;
  fetch?: typeof fetch;
  now?: () => number;
  log?: (line: string) => void;
};

export const connectionsEnabled = (env: Env = process.env) => env.ENABLE_CONNECTIONS === "true";

const envOf = (ctx: Ctx) => ctx.env ?? process.env;
const logOf = (ctx: Ctx) => ctx.log ?? ((l: string) => console.error(l));

type Visible = {
  id: string;
  business_id: string;
  provider: string;
  status: string;
  selected_entities: ConnectionEntity[];
};

// The connection as the caller sees it (RLS), or null.
async function visible(ctx: Ctx, connectionId: string): Promise<Visible | null> {
  const { data, error } = await ctx.userDb
    .from("connections")
    .select("id, business_id, provider, status, selected_entities")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Visible | null;
}

function tokenDeps(ctx: Ctx): TokenDeps {
  const env = envOf(ctx);
  return {
    async load(id) {
      const t = await getConnectionTokens(ctx.serviceDb, id);
      if (!t?.enc_access || !t.expires_at) return null;
      return { encAccess: t.enc_access, encRefresh: t.enc_refresh, expiresAt: t.expires_at, status: t.status };
    },
    save: (id, t) =>
      updateConnectionTokens(ctx.serviceDb, id, {
        encAccess: t.encAccess,
        expiresAt: t.expiresAt,
        ...(t.encRefresh ? { encRefresh: t.encRefresh } : {}),
      }),
    needsReauth: (id) => setConnectionStatus(ctx.serviceDb, id, "needs_reauth"),
    refresh: (r) => refreshAccessToken(r, { env, fetch: ctx.fetch, now: ctx.now?.() }),
    key: tokenKey(env),
    now: ctx.now,
  };
}

export type Failure =
  | "disabled"
  | "not_allowed"
  | "not_configured"
  | "not_connected"
  | "revoked"
  | "needs_reauth"
  | "refresh_failed"
  | "google_error";

// Known failures become an outcome; anything else (a DB error) is rethrown for the route's error state.
function failure(e: unknown): Failure {
  if (e instanceof ConnectionError) return e.reason;
  if (e instanceof TokenKeyError || (e instanceof OAuthError && e.reason === "not_configured")) return "not_configured";
  if (e instanceof GoogleApiError) return "google_error";
  throw e;
}

export async function beginGoogleConnect(
  ctx: Ctx,
  input: { businessId: string; connector: GoogleConnector; returnTo?: string },
): Promise<{ url: string; cookie: string } | Failure> {
  if (!connectionsEnabled(envOf(ctx))) return "disabled";
  if (!(await canConnectBusiness(ctx.userDb, input.businessId))) return "not_allowed";
  try {
    tokenKey(envOf(ctx)); // fail before Google if tokens couldn't be stored
    return startAuth(input.connector, input.businessId, envOf(ctx), ctx.now?.(), input.returnTo);
  } catch (e) {
    return failure(e);
  }
}

export type ConnectOutcome = {
  status: "connected" | "denied" | "error";
  connector: GoogleConnector | null;
  returnTo: string;
};

// The OAuth callback. The route clears the state cookie on every outcome.
export async function finishGoogleConnect(
  ctx: Ctx,
  q: { cookie: string | undefined; state: string | null; code: string | null; error: string | null },
): Promise<ConnectOutcome> {
  const log = logOf(ctx);
  let s;
  try {
    s = readState(q.cookie, q.state, ctx.now?.());
  } catch {
    log("connections: callback bad_state");
    return { status: "error", connector: null, returnTo: DEFAULT_RETURN };
  }
  const out = (status: ConnectOutcome["status"]) => {
    log(`connections: ${s.connector} ${status}`);
    return { status, connector: s.connector, returnTo: s.returnTo };
  };
  if (q.error || !q.code) return out("denied");
  const { data: auth } = await ctx.userDb.auth.getUser();
  if (!auth.user || !(await canConnectBusiness(ctx.userDb, s.businessId))) return out("error");
  try {
    const key = tokenKey(envOf(ctx));
    const t = await exchangeCode(
      { code: q.code, verifier: s.verifier, connector: s.connector },
      { env: envOf(ctx), fetch: ctx.fetch, now: ctx.now?.() },
    );
    await saveConnection(ctx.serviceDb, {
      businessId: s.businessId,
      provider: s.connector,
      externalAccountId: t.sub,
      scopes: t.scopes,
      connectedBy: auth.user.id,
      encAccess: encryptToken(t.accessToken, key),
      encRefresh: t.refreshToken ? encryptToken(t.refreshToken, key) : null,
      expiresAt: t.expiresAt,
    });
    return out("connected");
  } catch (e) {
    return out(e instanceof OAuthError && e.reason === "denied" ? "denied" : "error");
  }
}

// Revoke in Rank1: Google first (the whole grant), then revoke_connection, which revokes every Google
// connection on that grant and deletes the tokens. If Google can't be reached, nothing changes here.
export async function revokeGoogleConnection(
  ctx: Ctx,
  connectionId: string,
): Promise<"revoked" | "provider_failed" | Failure> {
  if (!connectionsEnabled(envOf(ctx))) return "disabled";
  const c = await visible(ctx, connectionId);
  if (!c || !(await canConnectBusiness(ctx.userDb, c.business_id))) return "not_allowed";
  const t = await getConnectionTokens(ctx.serviceDb, connectionId);
  const enc = t?.enc_refresh ?? t?.enc_access;
  if (enc) {
    let token: string;
    try {
      token = decryptToken(enc, tokenKey(envOf(ctx)));
    } catch (e) {
      return failure(e);
    }
    if (!(await revokeGrant(token, { fetch: ctx.fetch }))) return "provider_failed";
  }
  const revoked = await revokeConnection(ctx.serviceDb, connectionId);
  logOf(ctx)(`connections: ${c.provider} revoked (${revoked.length})`);
  return "revoked";
}

async function entitiesFor(
  provider: string,
  token: string,
  deps: { fetch?: typeof fetch },
): Promise<ConnectionEntity[]> {
  if (provider === "gbp") {
    const accounts = await listAccounts(token, deps);
    const lists = await Promise.all(accounts.map((a) => listLocations(token, a.name, deps)));
    return lists.flat().map((l) => ({ id: l.name, name: l.address ? `${l.title} · ${l.address}` : l.title }));
  }
  if (provider === "search_console")
    return (await listSites(token, deps)).filter((s) => s.readable).map((s) => ({ id: s.siteUrl, name: s.siteUrl }));
  if (provider === "ga4")
    return (await listGa4Properties(token, deps)).map((p) => ({
      id: p.property,
      name: p.account ? `${p.displayName} (${p.account})` : p.displayName,
    }));
  return [];
}

// The picker: locations (GBP), readable sites (Search Console) or properties (GA4) on the grant.
export async function listConnectionEntities(ctx: Ctx, connectionId: string): Promise<ConnectionEntity[] | Failure> {
  if (!connectionsEnabled(envOf(ctx))) return "disabled";
  const c = await visible(ctx, connectionId);
  if (!c || !(await canConnectBusiness(ctx.userDb, c.business_id))) return "not_allowed";
  try {
    return await withGoogleToken(connectionId, (t) => entitiesFor(c.provider, t, { fetch: ctx.fetch }), tokenDeps(ctx));
  } catch (e) {
    return failure(e);
  }
}

// Saves the picked ids, keeping only ones Google lists for this grant (at most 100, the DB limit).
export async function pickConnectionEntities(
  ctx: Ctx,
  connectionId: string,
  ids: string[],
): Promise<{ picked: number } | Failure> {
  const listed = await listConnectionEntities(ctx, connectionId);
  if (typeof listed === "string") return listed;
  const picked = listed.filter((e) => ids.includes(e.id)).slice(0, 100);
  await setConnectionEntities(ctx.serviceDb, connectionId, picked);
  return { picked: picked.length };
}

type EditTarget = { c: Visible; userId: string } | "not_allowed" | "not_selected" | "disabled";

async function editTarget(ctx: Ctx, connectionId: string, location: string): Promise<EditTarget> {
  if (!connectionsEnabled(envOf(ctx))) return "disabled";
  const c = await visible(ctx, connectionId);
  const { data: auth } = await ctx.userDb.auth.getUser();
  if (!c || c.provider !== "gbp" || !auth.user || !(await canApplyEdits(ctx.userDb, c.business_id)))
    return "not_allowed";
  if (!c.selected_entities.some((e) => e.id === location)) return "not_selected";
  return { c, userId: auth.user.id };
}

const diffLive = (ctx: Ctx, connectionId: string, location: string, proposed: GbpEdit) =>
  withGoogleToken(connectionId, (t) => readLocation(t, location, { fetch: ctx.fetch }), tokenDeps(ctx)).then((before) =>
    diffLocation(before, proposed),
  );

// The team's diff before applying: before → after per allowlisted field, from the live profile.
export async function previewGbpEdit(
  ctx: Ctx,
  connectionId: string,
  location: string,
  proposed: GbpEdit,
): Promise<{ changes: Change[] } | "not_selected" | "not_allowed_field" | Failure> {
  const target = await editTarget(ctx, connectionId, location);
  if (typeof target === "string") return target;
  try {
    return { changes: await diffLive(ctx, connectionId, location, proposed) };
  } catch (e) {
    if (e instanceof EditNotAllowed) return "not_allowed_field";
    return failure(e);
  }
}

// Applies exactly the diff the team confirmed. The live profile is re-read first; if the diff no longer
// matches (someone changed it at Google meanwhile), nothing is applied and the team sees a fresh preview.
export async function applyGbpEdit(
  ctx: Ctx,
  connectionId: string,
  location: string,
  proposed: GbpEdit,
  confirmed: Change[],
): Promise<{ applied: number } | "stale" | "not_selected" | "not_allowed_field" | Failure> {
  const target = await editTarget(ctx, connectionId, location);
  if (typeof target === "string") return target;
  let changes: Change[];
  let token: string;
  try {
    changes = await diffLive(ctx, connectionId, location, proposed);
    if (stable(changes) !== stable(confirmed)) return "stale";
    if (!changes.length) return { applied: 0 };
    // A fresh token (refreshed if needed). The apply itself is not retried, so no field is applied twice.
    token = await withGoogleToken(connectionId, async (t) => t, tokenDeps(ctx));
  } catch (e) {
    if (e instanceof EditNotAllowed) return "not_allowed_field";
    return failure(e);
  }
  try {
    const r = await applyEdits(token, location, changes, {
      fetch: ctx.fetch,
      record: async (ch) => {
        await recordConnectionChange(ctx.serviceDb, {
          connectionId,
          actor: target.userId,
          field: ch.field,
          before: ch.before as Json,
          after: ch.after as Json,
          providerRef: ch.providerRef,
        });
      },
    });
    logOf(ctx)(`connections: gbp edit applied (${r.applied})`);
    return r;
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 401) {
      await setConnectionStatus(ctx.serviceDb, connectionId, "needs_reauth");
      return "needs_reauth";
    }
    return failure(e);
  }
}
