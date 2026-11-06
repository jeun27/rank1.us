import "server-only";
import { sendEmail } from "@/lib/email/resend";
import type { DbClient } from "@/lib/queries/client";
import {
  canApplyEdits,
  canConnectBusiness,
  getConnectionTokens,
  recordConnectionChange,
  revokeConnection,
  saveConnection,
  setConnectionEntities,
  setConnectionEntityCount,
  setConnectionStatus,
  updateConnectionTokens,
  type ConnectionEntity,
} from "@/lib/queries/connections";
import { refreshGasReady } from "@/lib/queries/gas-ready";
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
import { checkVideo, type VideoChecks } from "@/lib/metrics/youtube-checks";
import { listMyChannels, listRecentVideos, type YoutubeVideo } from "./youtube";
import { refreshReadiness } from "./readiness";
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
  // G3: recompute gas_ready_at after a connection change (and email the team once). Tests inject a fake.
  readiness?: (businessId: string) => Promise<unknown>;
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

// After every save_connection, revoke_connection and needs_reauth (G3). Never throws.
function refreshReady(ctx: Ctx, businessId: string) {
  if (ctx.readiness) return ctx.readiness(businessId);
  return refreshReadiness(businessId, {
    async business(id) {
      const { data, error } = await ctx.serviceDb
        .from("businesses")
        .select("name, vertical")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refresh: (id, set) => refreshGasReady(ctx.serviceDb, id, set),
    send: sendEmail,
    env: envOf(ctx),
    log: logOf(ctx),
  });
}

function tokenDeps(ctx: Ctx, businessId: string): TokenDeps {
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
    async needsReauth(id) {
      await setConnectionStatus(ctx.serviceDb, id, "needs_reauth");
      await refreshReady(ctx, businessId);
    },
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
    const connectionId = await saveConnection(ctx.serviceDb, {
      businessId: s.businessId,
      provider: s.connector,
      externalAccountId: t.sub,
      scopes: t.scopes,
      connectedBy: auth.user.id,
      encAccess: encryptToken(t.accessToken, key),
      encRefresh: t.refreshToken ? encryptToken(t.refreshToken, key) : null,
      expiresAt: t.expiresAt,
    });
    await refreshReady(ctx, s.businessId);
    // X30: count the entities once now, with the fresh token, so the hub knows whether to offer a picker.
    await entitiesFor(s.connector, t.accessToken, { fetch: ctx.fetch })
      .then((list) => saveEntityCount(ctx, connectionId, list.length))
      .catch((e: unknown) => logOf(ctx)(`connections: entity count skipped (${codeOf(e)})`));
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
  await refreshReady(ctx, c.business_id);
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
  if (provider === "youtube") return (await listMyChannels(token, deps)).map((c) => ({ id: c.id, name: c.title }));
  if (provider === "ga4")
    return (await listGa4Properties(token, deps)).map((p) => ({
      id: p.property,
      name: p.account ? `${p.displayName} (${p.account})` : p.displayName,
    }));
  return [];
}

// The picker: locations (GBP), readable sites (Search Console) or properties (GA4) on the grant.
// X30 (backend 0040): connections.entity_count, so the hub shows "Choose …" only when there's more than one,
// without calling Google on render. Never fails the caller; logs the code only.
const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");
async function saveEntityCount(ctx: Ctx, connectionId: string, count: number) {
  try {
    await setConnectionEntityCount(ctx.serviceDb, connectionId, count);
  } catch (e) {
    logOf(ctx)(`connections: entity count not saved (${codeOf(e)})`);
  }
}

export async function listConnectionEntities(ctx: Ctx, connectionId: string): Promise<ConnectionEntity[] | Failure> {
  if (!connectionsEnabled(envOf(ctx))) return "disabled";
  const c = await visible(ctx, connectionId);
  if (!c || !(await canConnectBusiness(ctx.userDb, c.business_id))) return "not_allowed";
  try {
    const list = await withGoogleToken(
      connectionId,
      (t) => entitiesFor(c.provider, t, { fetch: ctx.fetch }),
      tokenDeps(ctx, c.business_id),
    );
    await saveEntityCount(ctx, connectionId, list.length);
    return list;
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

const diffLive = (ctx: Ctx, c: Visible, location: string, proposed: GbpEdit) =>
  withGoogleToken(c.id, (t) => readLocation(t, location, { fetch: ctx.fetch }), tokenDeps(ctx, c.business_id)).then(
    (before) => diffLocation(before, proposed),
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
    return { changes: await diffLive(ctx, target.c, location, proposed) };
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
    changes = await diffLive(ctx, target.c, location, proposed);
    if (stable(changes) !== stable(confirmed)) return "stale";
    if (!changes.length) return { applied: 0 };
    // A fresh token (refreshed if needed). The apply itself is not retried, so no field is applied twice.
    token = await withGoogleToken(connectionId, async (t) => t, tokenDeps(ctx, target.c.business_id));
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
      await refreshReady(ctx, target.c.business_id);
      return "needs_reauth";
    }
    return failure(e);
  }
}

export type YoutubeChecklist = {
  keyword: string | null;
  channel: { id: string; title: string } | null;
  videos: (YoutubeVideo & { checks: VideoChecks })[];
};

// G1: the picked channel (else the first one) and its newest videos, each checked against the business's
// one keyword: its category term (businesses.cuisine, the {cuisine} its questions are built from). No
// cuisine = no keyword, never a guess.
async function checklist(ctx: Ctx, c: Visible, keyword: string | null): Promise<YoutubeChecklist> {
  return withGoogleToken(
    c.id,
    async (t) => {
      const channels = await listMyChannels(t, { fetch: ctx.fetch });
      const ch = channels.find((x) => x.id === c.selected_entities[0]?.id) ?? channels[0];
      if (!ch?.uploads) return { keyword, channel: ch ? { id: ch.id, title: ch.title } : null, videos: [] };
      const videos = await listRecentVideos(t, ch.uploads, { fetch: ctx.fetch });
      return {
        keyword,
        channel: { id: ch.id, title: ch.title },
        videos: videos.map((v) => ({ ...v, checks: checkVideo(v, keyword) })),
      };
    },
    tokenDeps(ctx, c.business_id),
  );
}

const cuisineOf = async (db: DbClient, businessId: string) => {
  const { data, error } = await db.from("businesses").select("cuisine").eq("id", businessId).maybeSingle();
  if (error) throw error;
  return (data?.cuisine as string | null | undefined)?.trim() || null;
};

// The checklist page (members incl. the dfy_client, and the team on DFY), read-only.
export async function loadYoutubeChecklist(ctx: Ctx, connectionId: string): Promise<YoutubeChecklist | Failure> {
  if (!connectionsEnabled(envOf(ctx))) return "disabled";
  const c = await visible(ctx, connectionId);
  if (!c || c.provider !== "youtube") return "not_allowed";
  const [connect, edit] = await Promise.all([
    canConnectBusiness(ctx.userDb, c.business_id),
    canApplyEdits(ctx.userDb, c.business_id),
  ]);
  if (!connect && !edit) return "not_allowed";
  try {
    return await checklist(ctx, c, await cuisineOf(ctx.userDb, c.business_id));
  } catch (e) {
    return failure(e);
  }
}

// The weekly fix pass (service client): the business's live YouTube connection's checklist, null when it
// has none, or the connection's failure reason.
export async function youtubeChecklistForBusiness(
  serviceDb: DbClient,
  businessId: string,
  env: Env = process.env,
): Promise<YoutubeChecklist | null | Failure> {
  if (!connectionsEnabled(env)) return "disabled";
  const { data, error } = await serviceDb
    .from("connections")
    .select("id, business_id, provider, status, selected_entities")
    .eq("business_id", businessId)
    .eq("provider", "youtube")
    .neq("status", "revoked")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ctx: Ctx = { userDb: serviceDb, serviceDb, env };
  try {
    return await checklist(ctx, data as unknown as Visible, await cuisineOf(serviceDb, businessId));
  } catch (e) {
    return failure(e);
  }
}

// The fix pass's gate for R19–R21 (lead, #146): a live YouTube connection with a chosen channel, and a
// keyword (businesses.cuisine). Otherwise the rules don't apply and get no rows at all.
export async function youtubeReady(serviceDb: DbClient, businessId: string): Promise<boolean> {
  const { data, error } = await serviceDb
    .from("connections")
    .select("selected_entities")
    .eq("business_id", businessId)
    .eq("provider", "youtube")
    .eq("status", "connected")
    .maybeSingle();
  if (error) throw error;
  const picked = (data?.selected_entities as unknown as ConnectionEntity[] | undefined) ?? [];
  return picked.length > 0 && (await cuisineOf(serviceDb, businessId)) !== null;
}
