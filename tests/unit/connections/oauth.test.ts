import { createHash } from "node:crypto";
import "./no-live";
import { describe, expect, it, vi } from "vitest";
import {
  CALLBACK_PATH,
  exchangeCode,
  GOOGLE_SCOPES,
  OAuthError,
  readState,
  redirectUri,
  refreshAccessToken,
  revokeGrant,
  STATE_COOKIE,
  stateCookieOptions,
  startAuth,
} from "@/lib/connections/oauth";

const ENV = {
  GOOGLE_CLIENT_ID: "example-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "example-secret-not-real",
  NEXT_PUBLIC_SITE_URL: "https://rank1.example",
};
const NOW = 1_800_000_000_000;
// An unsigned example id_token: {"sub":"10769150350006150715113082367"} (synthetic).
const idToken = (sub: string) =>
  ["e30", Buffer.from(JSON.stringify({ sub, iss: "https://accounts.google.com" })).toString("base64url"), "sig"].join(
    ".",
  );
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("redirect URI", () => {
  it("is NEXT_PUBLIC_SITE_URL + the fixed callback path, never the request host", () => {
    expect(CALLBACK_PATH).toBe("/api/connections/google/callback");
    expect(redirectUri(ENV)).toBe("https://rank1.example/api/connections/google/callback");
    expect(redirectUri({ ...ENV, NEXT_PUBLIC_SITE_URL: "https://rank1.example/" })).toBe(
      "https://rank1.example/api/connections/google/callback",
    );
  });

  it("missing client id, secret or site URL → not_configured", () => {
    for (const k of Object.keys(ENV))
      expect(() => startAuth("ga4", "biz-1", { ...ENV, [k]: "" }, NOW)).toThrow("not_configured");
  });
});

describe("startAuth", () => {
  it.each(Object.entries(GOOGLE_SCOPES))(
    "%s asks only for its own scope + openid, offline, incremental, consent, PKCE S256",
    (connector, scope) => {
      const { url, cookie } = startAuth(connector as keyof typeof GOOGLE_SCOPES, "biz-1", ENV, NOW);
      const u = new URL(url);
      expect(`${u.origin}${u.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      const p = Object.fromEntries(u.searchParams);
      expect(p.scope.split(" ").sort()).toEqual(["openid", scope].sort());
      expect(p).toMatchObject({
        client_id: ENV.GOOGLE_CLIENT_ID,
        redirect_uri: "https://rank1.example/api/connections/google/callback",
        response_type: "code",
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
        code_challenge_method: "S256",
      });
      expect(url).not.toContain(ENV.GOOGLE_CLIENT_SECRET);
      const state = readState(cookie, p.state, NOW);
      expect(state).toMatchObject({ businessId: "biz-1", connector });
      expect(p.code_challenge).toBe(createHash("sha256").update(state.verifier).digest("base64url"));
      expect(state.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    },
  );

  it("scopes are exactly the approved read/edit set", () => {
    expect(GOOGLE_SCOPES).toEqual({
      gbp: "https://www.googleapis.com/auth/business.manage",
      search_console: "https://www.googleapis.com/auth/webmasters.readonly",
      ga4: "https://www.googleapis.com/auth/analytics.readonly",
    });
  });

  it("returnTo is kept only as a same-origin path (default /app)", () => {
    const read = (r?: string) => {
      const { url, cookie } = startAuth("gbp", "biz-1", ENV, NOW, r);
      return readState(cookie, new URL(url).searchParams.get("state"), NOW).returnTo;
    };
    expect(read("/client/settings")).toBe("/client/settings");
    expect(read()).toBe("/app");
    for (const bad of ["https://evil.example/x", "//evil.example", "/\\evil.example"]) expect(read(bad)).toBe("/app");
  });

  it("every start gets a fresh state and verifier", () => {
    const a = startAuth("ga4", "biz-1", ENV, NOW);
    const b = startAuth("ga4", "biz-1", ENV, NOW);
    expect(new URL(a.url).searchParams.get("state")).not.toBe(new URL(b.url).searchParams.get("state"));
    expect(a.cookie).not.toBe(b.cookie);
  });

  it("the state cookie is httpOnly, Secure, SameSite=Lax, scoped to the callback, 10 minutes", () => {
    expect(STATE_COOKIE).toBe("rank1_google_oauth");
    expect(stateCookieOptions).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/connections/google/callback",
      maxAge: 600,
    });
  });
});

describe("readState", () => {
  const { url, cookie } = startAuth("gbp", "biz-1", ENV, NOW);
  const state = new URL(url).searchParams.get("state")!;

  it("a wrong, missing or expired state is refused", () => {
    expect(() => readState(cookie, `${state}x`, NOW)).toThrow(OAuthError);
    expect(() => readState(cookie, null, NOW)).toThrow(OAuthError);
    expect(() => readState(undefined, state, NOW)).toThrow(OAuthError);
    expect(() => readState("not json", state, NOW)).toThrow(OAuthError);
    expect(() => readState(cookie, state, NOW + 600_001)).toThrow(OAuthError);
    expect(readState(cookie, state, NOW + 600_000).businessId).toBe("biz-1");
  });
});

describe("exchangeCode", () => {
  it("posts the code + verifier, requires the requested scope, and returns tokens with the Google sub", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({
        access_token: "ya29.example",
        refresh_token: "1//example-refresh",
        expires_in: 3599,
        scope: `openid ${GOOGLE_SCOPES.search_console}`,
        token_type: "Bearer",
        id_token: idToken("10769150350006150715113082367"),
      }),
    );
    const t = await exchangeCode(
      { code: "4/example-code", verifier: "v".repeat(43), connector: "search_console" },
      { env: ENV, fetch, now: NOW },
    );
    expect(t).toEqual({
      accessToken: "ya29.example",
      refreshToken: "1//example-refresh",
      expiresAt: new Date(NOW + 3599_000).toISOString(),
      scopes: ["openid", GOOGLE_SCOPES.search_console],
      sub: "10769150350006150715113082367",
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init!.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "authorization_code",
      code: "4/example-code",
      code_verifier: "v".repeat(43),
      client_id: ENV.GOOGLE_CLIENT_ID,
      client_secret: ENV.GOOGLE_CLIENT_SECRET,
      redirect_uri: "https://rank1.example/api/connections/google/callback",
    });
  });

  it("granular consent: the requested scope unticked → denied, nothing returned", async () => {
    const fetch = vi.fn(async () =>
      json({ access_token: "a", expires_in: 3599, scope: "openid", id_token: idToken("1") }),
    );
    await expect(
      exchangeCode({ code: "c", verifier: "v".repeat(43), connector: "ga4" }, { env: ENV, fetch, now: NOW }),
    ).rejects.toMatchObject({ reason: "denied" });
  });

  it("a Google error → exchange_failed, with no response text in the error", async () => {
    const fetch = vi.fn(async () => json({ error: "invalid_grant", error_description: "Bad Request" }, 400));
    const err = await exchangeCode(
      { code: "c", verifier: "v".repeat(43), connector: "ga4" },
      { env: ENV, fetch, now: NOW },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(OAuthError);
    expect(err.reason).toBe("exchange_failed");
    expect(String(err)).not.toContain("Bad Request");
  });
});

describe("refreshAccessToken", () => {
  it("returns a new access token and keeps the refresh token unless Google rotates it", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({ access_token: "ya29.new", expires_in: 3599, scope: "openid" }),
    );
    expect(await refreshAccessToken("1//example-refresh", { env: ENV, fetch, now: NOW })).toEqual({
      accessToken: "ya29.new",
      refreshToken: null,
      expiresAt: new Date(NOW + 3599_000).toISOString(),
    });
    const body = new URLSearchParams(String(fetch.mock.calls[0][1]!.body));
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("1//example-refresh");
  });

  it("invalid_grant (revoked at Google) → reauth", async () => {
    const fetch = vi.fn(async () => json({ error: "invalid_grant" }, 400));
    await expect(refreshAccessToken("r", { env: ENV, fetch, now: NOW })).rejects.toMatchObject({ reason: "reauth" });
  });

  it("any other failure → refresh_failed (retry next time, status unchanged)", async () => {
    const fetch = vi.fn(async () => json({ error: "internal_failure" }, 503));
    await expect(refreshAccessToken("r", { env: ENV, fetch, now: NOW })).rejects.toMatchObject({
      reason: "refresh_failed",
    });
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(refreshAccessToken("r", { env: ENV, fetch: down, now: NOW })).rejects.toMatchObject({
      reason: "refresh_failed",
    });
  });
});

describe("revokeGrant", () => {
  it("posts the token to Google's revoke endpoint; an already-revoked token (400) still counts as revoked", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 200 }));
    expect(await revokeGrant("1//example-refresh", { fetch })).toBe(true);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/revoke");
    expect(String(init.body)).toBe("token=1%2F%2Fexample-refresh");
    const gone = vi.fn(async () => json({ error: "invalid_token" }, 400));
    expect(await revokeGrant("r", { fetch: gone })).toBe(true);
    const down = vi.fn(async () => new Response("", { status: 503 }));
    expect(await revokeGrant("r", { fetch: down })).toBe(false);
  });
});
