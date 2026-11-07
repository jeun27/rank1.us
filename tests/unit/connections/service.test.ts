import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "./no-live";
import * as fx from "../../fixtures/google";

const q = vi.hoisted(() => ({
  canConnectBusiness: vi.fn(),
  canApplyEdits: vi.fn(),
  saveConnection: vi.fn(),
  getConnectionTokens: vi.fn(),
  updateConnectionTokens: vi.fn(),
  setConnectionEntities: vi.fn(),
  setConnectionEntityCount: vi.fn(),
  setConnectionStatus: vi.fn(),
  revokeConnection: vi.fn(),
  recordConnectionChange: vi.fn(),
}));
vi.mock("@/lib/queries/connections", async (real) => ({ ...(await real<object>()), ...q }));

const svc = await import("@/lib/connections/service");
const { encryptToken, decryptToken } = await import("@/lib/connections/crypto");
const { startAuth } = await import("@/lib/connections/oauth");

const KEY = randomBytes(32);
const NOW = 1_800_000_000_000;
const ENV = {
  ENABLE_CONNECTIONS: "true",
  GOOGLE_CLIENT_ID: "example-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "example-secret-not-real",
  GOOGLE_TOKEN_ENCRYPTION_KEY: KEY.toString("base64"),
  NEXT_PUBLIC_SITE_URL: "https://rank1.example",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const idToken = (sub: string) =>
  `e30.${Buffer.from(
    JSON.stringify({ sub, iss: "https://accounts.google.com", aud: ENV.GOOGLE_CLIENT_ID, exp: NOW / 1000 + 3600 }),
  ).toString("base64url")}.sig`;

// The caller's client: auth + the connection row they can see through RLS.
const conn = (over: Record<string, unknown> = {}) => ({
  id: "conn-1",
  business_id: "biz-1",
  provider: "gbp",
  status: "connected",
  selected_entities: [{ id: "locations/2000000000000000001", name: "Example Ramen House" }],
  ...over,
});
const userDb = (row: unknown = conn(), userId: string | null = "user-1") =>
  ({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
  }) as never;
const serviceDb = {} as never;
const tokens = (over: Record<string, unknown> = {}) => ({
  enc_access: encryptToken("ya29.current", KEY),
  enc_refresh: encryptToken("1//refresh", KEY),
  expires_at: new Date(NOW + 30 * 60_000).toISOString(),
  status: "connected",
  external_account_id: "sub-1",
  ...over,
});
const ctx = (fetch: typeof globalThis.fetch = vi.fn(), db = userDb()) => ({
  userDb: db,
  serviceDb,
  env: ENV,
  fetch,
  now: () => NOW,
  log: vi.fn(),
  readiness: vi.fn(async () => ({})),
});

beforeEach(() => {
  for (const f of Object.values(q)) f.mockReset();
  q.canConnectBusiness.mockResolvedValue(true);
  q.canApplyEdits.mockResolvedValue(true);
  q.getConnectionTokens.mockResolvedValue(tokens());
  q.saveConnection.mockResolvedValue("conn-1");
  q.revokeConnection.mockResolvedValue(["conn-1", "conn-2"]);
});

describe("the flag", () => {
  it("every entry point is off unless ENABLE_CONNECTIONS is exactly 'true'", async () => {
    for (const v of [undefined, "", "false", "TRUE", "1"]) {
      const c = { ...ctx(), env: { ...ENV, ENABLE_CONNECTIONS: v } };
      expect(svc.connectionsEnabled(c.env)).toBe(false);
      expect(await svc.beginGoogleConnect(c, { businessId: "biz-1", connector: "gbp" })).toBe("disabled");
      expect(await svc.revokeGoogleConnection(c, "conn-1")).toBe("disabled");
    }
    expect(q.canConnectBusiness).not.toHaveBeenCalled();
  });
});

describe("beginGoogleConnect", () => {
  it("checks can_connect_business with the caller's client first", async () => {
    q.canConnectBusiness.mockResolvedValue(false);
    expect(await svc.beginGoogleConnect(ctx(), { businessId: "biz-1", connector: "gbp" })).toBe("not_allowed");
    q.canConnectBusiness.mockResolvedValue(true);
    const r = await svc.beginGoogleConnect(ctx(), { businessId: "biz-1", connector: "ga4", returnTo: "/client" });
    expect(r).toMatchObject({ url: expect.stringContaining("accounts.google.com"), cookie: expect.any(String) });
  });
});

describe("finishGoogleConnect", () => {
  const started = () => {
    const { url, cookie } = startAuth("gbp", "biz-1", ENV, NOW, "/client");
    return { cookie, state: new URL(url).searchParams.get("state")! };
  };
  const googleOk = () =>
    vi.fn<typeof globalThis.fetch>(async () =>
      json({
        access_token: "ya29.new",
        refresh_token: "1//new",
        expires_in: 3599,
        scope: "openid https://www.googleapis.com/auth/business.manage",
        id_token: idToken("sub-1"),
      }),
    );

  it("connects: stores ciphertext only, the Google sub and scopes, connected_by = the caller", async () => {
    const c = ctx(googleOk());
    expect(await svc.finishGoogleConnect(c, { ...started(), code: "4/example", error: null })).toEqual({
      status: "connected",
      connector: "gbp",
      returnTo: "/client",
    });
    const saved = q.saveConnection.mock.calls[0][1];
    expect(saved).toMatchObject({
      businessId: "biz-1",
      provider: "gbp",
      externalAccountId: "sub-1",
      connectedBy: "user-1",
      scopes: ["openid", "https://www.googleapis.com/auth/business.manage"],
    });
    expect(decryptToken(saved.encAccess, KEY)).toBe("ya29.new");
    expect(decryptToken(saved.encRefresh, KEY)).toBe("1//new");
    expect(JSON.stringify(saved)).not.toMatch(/ya29\.new|1\/\/new/);
    expect(c.log.mock.calls.flat().join(" ")).not.toMatch(/ya29|1\/\/|4\/example|sub-1|user-1/);
  });

  it("Google's access_denied (the user said no) → denied, nothing stored, no token call", async () => {
    const c = ctx(googleOk());
    expect(await svc.finishGoogleConnect(c, { ...started(), code: null, error: "access_denied" })).toMatchObject({
      status: "denied",
    });
    expect(c.fetch).not.toHaveBeenCalled();
    expect(q.saveConnection).not.toHaveBeenCalled();
  });

  it("a bad state → error with the default return path, before any Google call", async () => {
    const c = ctx(googleOk());
    const { cookie } = started();
    expect(await svc.finishGoogleConnect(c, { cookie, state: "forged", code: "4/x", error: null })).toEqual({
      status: "error",
      connector: null,
      returnTo: "/app/settings",
    });
    expect(c.fetch).not.toHaveBeenCalled();
  });

  it("access lost since the start (or signed out) → error, nothing stored", async () => {
    q.canConnectBusiness.mockResolvedValue(false);
    expect((await svc.finishGoogleConnect(ctx(googleOk()), { ...started(), code: "4/x", error: null })).status).toBe(
      "error",
    );
    q.canConnectBusiness.mockResolvedValue(true);
    const signedOut = ctx(googleOk(), userDb(conn(), null));
    expect((await svc.finishGoogleConnect(signedOut, { ...started(), code: "4/x", error: null })).status).toBe("error");
    expect(q.saveConnection).not.toHaveBeenCalled();
  });

  it("the business.manage box unticked (granular consent) → denied", async () => {
    const fetch = vi.fn(async () =>
      json({ access_token: "a", expires_in: 3599, scope: "openid", id_token: idToken("s") }),
    );
    expect((await svc.finishGoogleConnect(ctx(fetch), { ...started(), code: "4/x", error: null })).status).toBe(
      "denied",
    );
    expect(q.saveConnection).not.toHaveBeenCalled();
  });
});

describe("two Google accounts on one business", () => {
  it("each connect stores its own Google sub, so the DB keeps them as separate grants", async () => {
    const connect = async (connector: "gbp" | "ga4", sub: string, scope: string) => {
      const { url, cookie } = startAuth(connector, "biz-1", ENV, NOW);
      const fetch = vi.fn(async () =>
        json({
          access_token: `ya29.${sub}`,
          refresh_token: `1//${sub}`,
          expires_in: 3599,
          scope: `openid ${scope}`,
          id_token: idToken(sub),
        }),
      );
      return svc.finishGoogleConnect(ctx(fetch), {
        cookie,
        state: new URL(url).searchParams.get("state")!,
        code: "4/x",
        error: null,
      });
    };
    await connect("gbp", "sub-a", "https://www.googleapis.com/auth/business.manage");
    await connect("ga4", "sub-b", "https://www.googleapis.com/auth/analytics.readonly");
    expect(q.saveConnection.mock.calls.map((c) => [c[1].provider, c[1].externalAccountId])).toEqual([
      ["gbp", "sub-a"],
      ["ga4", "sub-b"],
    ]);
    expect(decryptToken(q.saveConnection.mock.calls[1][1].encRefresh, KEY)).toBe("1//sub-b");
  });

  it("revoking one connection revokes only its own grant's token at Google; revoke_connection scopes the rest", async () => {
    q.getConnectionTokens.mockResolvedValue(
      tokens({ enc_refresh: encryptToken("1//sub-a", KEY), external_account_id: "sub-a" }),
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("", { status: 200 }));
    await svc.revokeGoogleConnection(ctx(fetch), "conn-1");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][1]!.body)).toBe("token=1%2F%2Fsub-a");
    expect(q.revokeConnection).toHaveBeenCalledWith(serviceDb, "conn-1");
  });

  it("the Google sub is never logged", async () => {
    const c = ctx(vi.fn(async () => new Response("", { status: 200 })));
    await svc.revokeGoogleConnection(c, "conn-1");
    expect(c.log.mock.calls.flat().join(" ")).not.toContain("sub-");
  });
});

describe("revokeGoogleConnection", () => {
  it("revokes with Google first (the refresh token), then revoke_connection for the grant", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("", { status: 200 }));
    expect(await svc.revokeGoogleConnection(ctx(fetch), "conn-1")).toBe("revoked");
    expect(String(fetch.mock.calls[0][1]!.body)).toBe("token=1%2F%2Frefresh");
    expect(fetch.mock.invocationCallOrder[0]).toBeLessThan(q.revokeConnection.mock.invocationCallOrder[0]);
    expect(q.revokeConnection).toHaveBeenCalledWith(serviceDb, "conn-1");
  });

  it("Google unreachable → provider_failed and nothing changes in Rank1", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 503 }));
    expect(await svc.revokeGoogleConnection(ctx(fetch), "conn-1")).toBe("provider_failed");
    expect(q.revokeConnection).not.toHaveBeenCalled();
  });

  it("no stored tokens (already gone) still revokes in Rank1", async () => {
    q.getConnectionTokens.mockResolvedValue(null);
    expect(await svc.revokeGoogleConnection(ctx(), "conn-1")).toBe("revoked");
    expect(q.revokeConnection).toHaveBeenCalled();
  });

  it("a connection the caller can't see, or can't connect for (the team), → not_allowed", async () => {
    expect(await svc.revokeGoogleConnection(ctx(vi.fn(), userDb(null)), "conn-1")).toBe("not_allowed");
    q.canConnectBusiness.mockResolvedValue(false);
    expect(await svc.revokeGoogleConnection(ctx(), "conn-1")).toBe("not_allowed");
    expect(q.revokeConnection).not.toHaveBeenCalled();
  });
});

describe("the entity picker", () => {
  const gbpFetch = () =>
    vi.fn<typeof globalThis.fetch>(async (input) => {
      const u = new URL(String(input));
      if (u.host === "mybusinessaccountmanagement.googleapis.com") return json(fx.accountsPage2);
      return json(fx.locations);
    });

  it("lists GBP locations across accounts", async () => {
    expect(await svc.listConnectionEntities(ctx(gbpFetch()), "conn-1")).toEqual([
      { id: "locations/2000000000000000001", name: "Example Ramen House · 1 Example St, Irvine, CA" },
      { id: "locations/2000000000000000002", name: "Example Ramen House Tustin · 2 Example Ave, Tustin, CA" },
    ]);
  });

  it("lists only readable Search Console sites, and GA4 properties", async () => {
    const sc = ctx(
      vi.fn(async () => json(fx.sites)),
      userDb(conn({ provider: "search_console" })),
    );
    expect(await svc.listConnectionEntities(sc, "conn-1")).toEqual([
      { id: "https://example.com/", name: "https://example.com/" },
      { id: "sc-domain:example.com", name: "sc-domain:example.com" },
    ]);
    const ga = ctx(
      vi.fn(async () => json(fx.accountSummaries)),
      userDb(conn({ provider: "ga4" })),
    );
    expect(await svc.listConnectionEntities(ga, "conn-1")).toEqual([
      { id: "properties/400000001", name: "example.com (Example Ramen House)" },
    ]);
  });

  it("lists the owner's YouTube channels", async () => {
    const yt = ctx(
      vi.fn(async () => json(fx.ytChannels)),
      userDb(conn({ provider: "youtube" })),
    );
    expect(await svc.listConnectionEntities(yt, "conn-1")).toEqual([
      { id: "UCexample000000000000001", name: "Example Ramen House" },
    ]);
  });

  it("stores how many entities the account offers", async () => {
    await svc.listConnectionEntities(ctx(gbpFetch()), "conn-1");
    expect(q.setConnectionEntityCount).toHaveBeenCalledWith(serviceDb, "conn-1", 2);
  });

  it("a failed count save is logged by code and the list still returns", async () => {
    q.setConnectionEntityCount.mockRejectedValue({ code: "22023", message: "Unknown connection" });
    const c = ctx(gbpFetch());
    expect(await svc.listConnectionEntities(c, "conn-1")).toHaveLength(2);
    expect(c.log).toHaveBeenCalledWith("connections: entity count not saved (22023)");
  });

  it("picking keeps only ids Google listed (no arbitrary ids)", async () => {
    const r = await svc.pickConnectionEntities(ctx(gbpFetch()), "conn-1", [
      "locations/2000000000000000002",
      "locations/9999",
    ]);
    expect(r).toEqual({ picked: 1 });
    expect(q.setConnectionEntities).toHaveBeenCalledWith(serviceDb, "conn-1", [
      { id: "locations/2000000000000000002", name: "Example Ramen House Tustin · 2 Example Ave, Tustin, CA" },
    ]);
  });

  it("a revoked grant at Google → needs_reauth recorded and returned", async () => {
    q.getConnectionTokens.mockResolvedValue(tokens({ expires_at: new Date(NOW).toISOString() }));
    const fetch = vi.fn(async () => json({ error: "invalid_grant" }, 400));
    expect(await svc.listConnectionEntities(ctx(fetch), "conn-1")).toBe("needs_reauth");
    expect(q.setConnectionStatus).toHaveBeenCalledWith(serviceDb, "conn-1", "needs_reauth");
  });
});

describe("GBP edits (preview → confirm → apply)", () => {
  const LOC = "locations/2000000000000000001";
  const gbp = (patches: string[] = []) =>
    vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const u = new URL(String(input));
      if (init?.method === "PATCH") {
        patches.push(`${u.pathname}?${u.searchParams}`);
        return json({ name: LOC });
      }
      return json(u.pathname.endsWith("/attributes") ? fx.attributes : fx.location);
    });
  const proposed = { description: "Example ramen and gyoza in Irvine." };
  const change = {
    field: "description",
    before: "Example ramen in Irvine.",
    after: "Example ramen and gyoza in Irvine.",
  };

  it("preview diffs the live location against the proposal", async () => {
    expect(await svc.previewGbpEdit(ctx(gbp()), "conn-1", LOC, proposed)).toEqual({ changes: [change] });
  });

  it("apply re-reads, applies the confirmed diff, and logs who/field/before/after/provider ref", async () => {
    const patches: string[] = [];
    expect(await svc.applyGbpEdit(ctx(gbp(patches)), "conn-1", LOC, proposed, [change])).toEqual({ applied: 1 });
    expect(patches).toEqual([
      `/v1/${LOC}?updateMask=profile.description&validateOnly=true`,
      `/v1/${LOC}?updateMask=profile.description`,
    ]);
    expect(q.recordConnectionChange).toHaveBeenCalledWith(serviceDb, {
      connectionId: "conn-1",
      actor: "user-1",
      ...change,
      providerRef: LOC,
    });
  });

  it("the live profile changed since the preview → stale, nothing applied", async () => {
    const patches: string[] = [];
    const old = { ...change, before: "Something else" };
    expect(await svc.applyGbpEdit(ctx(gbp(patches)), "conn-1", LOC, proposed, [old])).toBe("stale");
    expect(patches).toEqual([]);
  });

  it("a dfy_client (can_apply_edits false) can't preview or apply", async () => {
    q.canApplyEdits.mockResolvedValue(false);
    expect(await svc.previewGbpEdit(ctx(gbp()), "conn-1", LOC, proposed)).toBe("not_allowed");
    expect(await svc.applyGbpEdit(ctx(gbp()), "conn-1", LOC, proposed, [change])).toBe("not_allowed");
  });

  it("only picked locations, only GBP connections, and only allowlisted fields", async () => {
    expect(await svc.previewGbpEdit(ctx(gbp()), "conn-1", "locations/2000000000000000002", proposed)).toBe(
      "not_selected",
    );
    const sc = ctx(gbp(), userDb(conn({ provider: "search_console" })));
    expect(await svc.previewGbpEdit(sc, "conn-1", LOC, proposed)).toBe("not_allowed");
    expect(await svc.previewGbpEdit(ctx(gbp()), "conn-1", LOC, { categories: "x" } as never)).toBe("not_allowed_field");
  });

  it("a 401 while applying → needs_reauth recorded; nothing logged", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) =>
      init?.method === "PATCH"
        ? json({}, 401)
        : json(new URL(String(input)).pathname.endsWith("/attributes") ? fx.attributes : fx.location),
    );
    expect(await svc.applyGbpEdit(ctx(fetch), "conn-1", LOC, proposed, [change])).toBe("needs_reauth");
    expect(q.setConnectionStatus).toHaveBeenCalledWith(serviceDb, "conn-1", "needs_reauth");
    expect(q.recordConnectionChange).not.toHaveBeenCalled();
  });
});

describe("G3: GAS readiness is refreshed after every connection change", () => {
  const LOC = "locations/2000000000000000001";
  const started = (connector: "gbp" | "ga4" = "gbp") => {
    const { url, cookie } = startAuth(connector, "biz-1", ENV, NOW);
    return { cookie, state: new URL(url).searchParams.get("state")! };
  };

  it("after save_connection (a successful connect), for that business", async () => {
    const fetch = vi.fn(async () =>
      json({
        access_token: "ya29.x",
        refresh_token: "1//x",
        expires_in: 3599,
        scope: "openid https://www.googleapis.com/auth/business.manage",
        id_token: idToken("sub-1"),
      }),
    );
    const c = ctx(fetch);
    await svc.finishGoogleConnect(c, { ...started(), code: "4/x", error: null });
    expect(c.readiness).toHaveBeenCalledWith("biz-1");
    expect(q.saveConnection.mock.invocationCallOrder[0]).toBeLessThan(c.readiness.mock.invocationCallOrder[0]);
  });

  it("not after a denied or failed connect (nothing changed)", async () => {
    const c = ctx(vi.fn());
    await svc.finishGoogleConnect(c, { ...started(), code: null, error: "access_denied" });
    expect(c.readiness).not.toHaveBeenCalled();
  });

  it("after revoke_connection", async () => {
    const c = ctx(vi.fn(async () => new Response("", { status: 200 })));
    await svc.revokeGoogleConnection(c, "conn-1");
    expect(c.readiness).toHaveBeenCalledWith("biz-1");
    expect(q.revokeConnection.mock.invocationCallOrder[0]).toBeLessThan(c.readiness.mock.invocationCallOrder[0]);
  });

  it("not when Google's revoke failed (nothing changed in Rank1)", async () => {
    const c = ctx(vi.fn(async () => new Response("", { status: 503 })));
    await svc.revokeGoogleConnection(c, "conn-1");
    expect(c.readiness).not.toHaveBeenCalled();
  });

  it("after a token-refresh failure marks needs_reauth", async () => {
    q.getConnectionTokens.mockResolvedValue(tokens({ expires_at: new Date(NOW).toISOString() }));
    const c = ctx(vi.fn(async () => json({ error: "invalid_grant" }, 400)));
    expect(await svc.listConnectionEntities(c, "conn-1")).toBe("needs_reauth");
    expect(c.readiness).toHaveBeenCalledWith("biz-1");
  });

  it("after a 401 while applying a GBP edit marks needs_reauth", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) =>
      init?.method === "PATCH"
        ? json({}, 401)
        : json(new URL(String(input)).pathname.endsWith("/attributes") ? fx.attributes : fx.location),
    );
    const c = ctx(fetch);
    const change = {
      field: "description",
      before: "Example ramen in Irvine.",
      after: "Example ramen and gyoza in Irvine.",
    };
    expect(await svc.applyGbpEdit(c, "conn-1", LOC, { description: change.after }, [change])).toBe("needs_reauth");
    expect(c.readiness).toHaveBeenCalledWith("biz-1");
  });

  it("flag off → no connection change, no readiness refresh", async () => {
    const c = { ...ctx(vi.fn()), env: { ...ENV, ENABLE_CONNECTIONS: "false" } };
    await svc.revokeGoogleConnection(c, "conn-1");
    expect(c.readiness).not.toHaveBeenCalled();
  });
});

describe("G1 YouTube checklist", () => {
  const ytFetch = () =>
    vi.fn<typeof globalThis.fetch>(async (input) => {
      const u = new URL(String(input));
      if (u.pathname.endsWith("/channels")) return json(fx.ytChannels);
      if (u.pathname.endsWith("/playlistItems"))
        return json(u.searchParams.get("pageToken") ? fx.ytPlaylistPage2 : fx.ytPlaylistPage1);
      return json(fx.ytVideos);
    });
  // The caller's client: the youtube connection row, then the business's cuisine (the keyword).
  const ytDb = (cuisine: string | null = "ramen") => {
    let n = 0;
    return {
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              n++ === 0
                ? { data: conn({ provider: "youtube", selected_entities: [] }), error: null }
                : { data: { cuisine }, error: null },
          }),
        }),
      }),
    } as never;
  };

  it("reads the channel's newest videos and checks each against the business's keyword", async () => {
    const r = await svc.loadYoutubeChecklist(ctx(ytFetch(), ytDb()), "conn-1");
    expect(r).toMatchObject({
      keyword: "ramen",
      channel: { id: "UCexample000000000000001", title: "Example Ramen House" },
    });
    const v = (r as { videos: { id: string; checks: unknown }[] }).videos;
    expect(v.map((x) => [x.id, x.checks])).toEqual([
      ["vid-1", { title: "pass", description: "pass", chapters: "pass", saysKeyword: "cant_check" }],
      ["vid-2", { title: "fail", description: "fail", chapters: "not_needed", saysKeyword: "cant_check" }],
      ["vid-3", { title: "fail", description: "fail", chapters: "fail", saysKeyword: "cant_check" }],
    ]);
  });

  it("no cuisine → no keyword, never a guess", async () => {
    const r = await svc.loadYoutubeChecklist(ctx(ytFetch(), ytDb(null)), "conn-1");
    expect((r as { keyword: string | null }).keyword).toBeNull();
  });

  it("not a YouTube connection, or no access → not_allowed; flag off → disabled", async () => {
    expect(await svc.loadYoutubeChecklist(ctx(ytFetch()), "conn-1")).toBe("not_allowed"); // the gbp row
    q.canConnectBusiness.mockResolvedValue(false);
    q.canApplyEdits.mockResolvedValue(false);
    expect(await svc.loadYoutubeChecklist(ctx(ytFetch(), ytDb()), "conn-1")).toBe("not_allowed");
    const off = { ...ctx(ytFetch(), ytDb()), env: { ...ENV, ENABLE_CONNECTIONS: "false" } };
    expect(await svc.loadYoutubeChecklist(off, "conn-1")).toBe("disabled");
  });
});

// The picker-load count is covered above ("stores how many entities the account offers", #183).
describe("X30: the entity count right after a connect", () => {
  const gbpFetch = () =>
    vi.fn<typeof globalThis.fetch>(async (input) => {
      const u = new URL(String(input));
      if (u.host === "oauth2.googleapis.com")
        return json({
          access_token: "ya29.new",
          refresh_token: "1//new",
          expires_in: 3599,
          scope: "openid https://www.googleapis.com/auth/business.manage",
          id_token: idToken("sub-1"),
        });
      if (u.host === "mybusinessaccountmanagement.googleapis.com") return json(fx.accountsPage2);
      return json(fx.locations);
    });

  it("right after a connect, the count is saved once with the fresh token", async () => {
    const { url, cookie } = startAuth("gbp", "biz-1", ENV, NOW);
    q.saveConnection.mockResolvedValue("conn-9");
    const c = ctx(gbpFetch());
    const out = await svc.finishGoogleConnect(c, {
      cookie,
      state: new URL(url).searchParams.get("state")!,
      code: "4/x",
      error: null,
    });
    expect(out.status).toBe("connected");
    expect(q.setConnectionEntityCount).toHaveBeenCalledWith(serviceDb, "conn-9", 2);
  });

  it("a connect still succeeds when listing for the count fails", async () => {
    const { url, cookie } = startAuth("gbp", "biz-1", ENV, NOW);
    q.saveConnection.mockResolvedValue("conn-9");
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      new URL(String(input)).host === "oauth2.googleapis.com"
        ? json({
            access_token: "ya29.new",
            expires_in: 3599,
            scope: "openid https://www.googleapis.com/auth/business.manage",
            id_token: idToken("sub-1"),
          })
        : json({}, 503),
    );
    const out = await svc.finishGoogleConnect(ctx(fetch), {
      cookie,
      state: new URL(url).searchParams.get("state")!,
      code: "4/x",
      error: null,
    });
    expect(out.status).toBe("connected");
    expect(q.setConnectionEntityCount).not.toHaveBeenCalled();
  });
});
