import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { safeNext } from "@/lib/auth/next";

// One Google OAuth client for every Google connector, with incremental authorization: each connector asks
// only for its own scope (+ openid, for the account `sub` that identifies the grant; no email or profile).
// https://developers.google.com/identity/protocols/oauth2/web-server
export const GOOGLE_SCOPES = {
  gbp: "https://www.googleapis.com/auth/business.manage",
  search_console: "https://www.googleapis.com/auth/webmasters.readonly",
  ga4: "https://www.googleapis.com/auth/analytics.readonly",
} as const;
export type GoogleConnector = keyof typeof GOOGLE_SCOPES;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

// The redirect URI registered in the Google client. Built from NEXT_PUBLIC_SITE_URL, never the request host.
export const CALLBACK_PATH = "/api/connections/google/callback";
export const STATE_COOKIE = "rank1_google_oauth";
const STATE_TTL_MS = 600_000;
export const stateCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: CALLBACK_PATH,
  maxAge: STATE_TTL_MS / 1000,
} as const;

export type OAuthReason = "not_configured" | "bad_state" | "denied" | "exchange_failed" | "reauth" | "refresh_failed";
// The message is the reason only: never a code, state, token, email or Google's error text.
export class OAuthError extends Error {
  constructor(readonly reason: OAuthReason) {
    super(reason);
  }
}

type Env = Record<string, string | undefined>;

function config(env: Env) {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, NEXT_PUBLIC_SITE_URL: site } = env;
  if (!id || !secret || !site) throw new OAuthError("not_configured");
  return { id, secret, redirect: `${site.replace(/\/+$/, "")}${CALLBACK_PATH}` };
}

export const redirectUri = (env: Env = process.env) => config(env).redirect;

const b64url = (n: number) => randomBytes(n).toString("base64url");

export type OAuthState = {
  state: string;
  verifier: string;
  businessId: string;
  connector: GoogleConnector;
  // A same-origin path (safeNext) the callback sends the user back to.
  returnTo: string;
  exp: number;
};

// state (32 random bytes) and the PKCE verifier live only in the callback-scoped httpOnly cookie.
export function startAuth(
  connector: GoogleConnector,
  businessId: string,
  env: Env = process.env,
  now = Date.now(),
  returnTo = "/app",
) {
  const c = config(env);
  const s: OAuthState = {
    state: b64url(32),
    verifier: b64url(48),
    businessId,
    connector,
    returnTo: safeNext(returnTo) ?? "/app",
    exp: now + STATE_TTL_MS,
  };
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: c.id,
    redirect_uri: c.redirect,
    response_type: "code",
    scope: `openid ${GOOGLE_SCOPES[connector]}`,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: s.state,
    code_challenge: createHash("sha256").update(s.verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), cookie: Buffer.from(JSON.stringify(s)).toString("base64url") };
}

const sameString = (a: string, b: string) => {
  const d = (x: string) => createHash("sha256").update(x).digest();
  return timingSafeEqual(d(a), d(b));
};

// The callback's state must match the cookie (constant-time) and be under 10 minutes old.
export function readState(cookie: string | undefined, state: string | null, now = Date.now()): OAuthState {
  if (!cookie || !state) throw new OAuthError("bad_state");
  let s: OAuthState;
  try {
    s = JSON.parse(Buffer.from(cookie, "base64url").toString("utf8"));
  } catch {
    throw new OAuthError("bad_state");
  }
  if (typeof s?.state !== "string" || !(s.connector in GOOGLE_SCOPES) || !sameString(s.state, state) || now > s.exp)
    throw new OAuthError("bad_state");
  return { ...s, returnTo: safeNext(s.returnTo) ?? "/app" };
}

type Deps = { env?: Env; fetch?: typeof fetch; now?: number };

async function tokenCall(params: Record<string, string>, deps: Deps) {
  const res = await (deps.fetch ?? fetch)(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, body };
}

// The id_token is read only from Google's token endpoint response (TLS), so no signature check is needed
// (OpenID Connect Core 3.1.3.7), but iss, aud and exp are checked. Only `sub` is used; it identifies the
// Google account of the grant and is never logged or shown.
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const subOf = (idToken: unknown, clientId: string, now: number) => {
  try {
    const c = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8"));
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    const ok =
      GOOGLE_ISSUERS.includes(c.iss) && aud.includes(clientId) && typeof c.exp === "number" && c.exp * 1000 > now;
    return ok && typeof c.sub === "string" && c.sub ? (c.sub as string) : null;
  } catch {
    return null;
  }
};

export type GrantedTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
  sub: string;
};

export async function exchangeCode(
  input: { code: string; verifier: string; connector: GoogleConnector },
  deps: Deps = {},
): Promise<GrantedTokens> {
  const c = config(deps.env ?? process.env);
  const { ok, body } = await tokenCall(
    {
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.verifier,
      client_id: c.id,
      client_secret: c.secret,
      redirect_uri: c.redirect,
    },
    deps,
  ).catch(() => ({ ok: false, body: {} as Record<string, unknown> }));
  const sub = subOf(body.id_token, c.id, deps.now ?? Date.now());
  if (!ok || typeof body.access_token !== "string" || !sub) throw new OAuthError("exchange_failed");
  // Granular consent: the user can untick the scope; then nothing is stored.
  const scopes = String(body.scope ?? "")
    .split(" ")
    .filter(Boolean);
  if (!scopes.includes(GOOGLE_SCOPES[input.connector])) throw new OAuthError("denied");
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
    expiresAt: new Date((deps.now ?? Date.now()) + Number(body.expires_in ?? 0) * 1000).toISOString(),
    scopes,
    sub,
  };
}

// invalid_grant = the grant was revoked or expired at Google → the connection needs reauth (no retry).
export async function refreshAccessToken(refreshToken: string, deps: Deps = {}) {
  const c = config(deps.env ?? process.env);
  const { ok, body } = await tokenCall(
    { grant_type: "refresh_token", refresh_token: refreshToken, client_id: c.id, client_secret: c.secret },
    deps,
  ).catch(() => ({ ok: false, body: {} as Record<string, unknown> }));
  if (body.error === "invalid_grant") throw new OAuthError("reauth");
  if (!ok || typeof body.access_token !== "string") throw new OAuthError("refresh_failed");
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
    expiresAt: new Date((deps.now ?? Date.now()) + Number(body.expires_in ?? 0) * 1000).toISOString(),
  };
}

// Revokes the whole grant (every scope on it). A token Google already dropped (400) counts as revoked.
export async function revokeGrant(token: string, deps: { fetch?: typeof fetch } = {}): Promise<boolean> {
  try {
    const res = await (deps.fetch ?? fetch)(REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

// Where the browser goes after start/callback: the same-origin return path on NEXT_PUBLIC_SITE_URL, with the
// outcome in the query (never a code, token or account detail).
export function returnUrl(returnTo: string, params: Record<string, string | null>, base: string) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || base).replace(/\/+$/, "");
  const u = new URL(`${site}${safeNext(returnTo) ?? "/app"}`);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}
