import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDfyClient } from "@/lib/queries/onboarding";
import {
  CONNECTOR_KEYS,
  canApplyEdits,
  canConnectBusiness,
  getConnectionTokens,
  listConnectionChanges,
  listConnections,
  listConnectorInterest,
  noteConnectorInterest,
  recordConnectionChange,
  revokeConnection,
  saveConnection,
  setConnectionEntities,
  setConnectionStatus,
  updateConnectionTokens,
} from "@/lib/queries/connections";
import { anonClient, makeWorkspace, must, newUser, serviceClient, type Fixture, type TestUser } from "./helpers";

// Connections (0021). Users read; every write is a service RPC called by a server route after
// can_connect_business / can_apply_edits. Tokens are ciphertext and unreadable by any user.
const loose = (db: unknown) => db as SupabaseClient;
const svc = () => serviceClient();

let owner: TestUser;
let f: Fixture;
let team: TestUser;
let client: TestUser;
let outsider: TestUser;
let dfy: { workspaceId: string; businessId: string };

const tokens = (tag: string) => ({
  encAccess: `enc:v1:access-${tag}`,
  encRefresh: `enc:v1:refresh-${tag}`,
  expiresAt: "2026-11-06T01:00:00Z",
});

// One Google account (sub) per test unless given, so a business's Google connections share a grant.
const connect = (
  businessId: string,
  provider: "gbp" | "search_console" | "ga4" | "shopify",
  tag: string = provider,
  account = provider === "shopify" ? "example-shop.myshopify.com" : "google-sub-example",
) =>
  saveConnection(svc(), {
    businessId,
    provider,
    externalAccountId: account,
    scopes: [`scope-${provider}`],
    connectedBy: owner.id,
    ...tokens(tag),
  });

beforeAll(async () => {
  owner = await newUser("conn-owner");
  f = await makeWorkspace(owner);
  outsider = await newUser("conn-outsider");
  team = await newUser("conn-team");
  client = await newUser("conn-client");
  const creator = await newUser("conn-creator");
  must(
    await svc()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: creator.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
  dfy = await createDfyClient(creator.db, {
    workspace_name: "Example DFY",
    business: {
      name: "Example Pho Spot",
      domain: "example-pho.test",
      cuisine: "pho",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
  });
  must(
    await svc().from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
  );
});

describe("access checks", () => {
  it("self-serve members connect and apply edits", async () => {
    expect(await canConnectBusiness(owner.db, f.businessId)).toBe(true);
    expect(await canApplyEdits(owner.db, f.businessId)).toBe(true);
  });

  it("a dfy_client connects and revokes its own business, but never applies edits", async () => {
    expect(await canConnectBusiness(client.db, dfy.businessId)).toBe(true);
    expect(await canApplyEdits(client.db, dfy.businessId)).toBe(false);
  });

  it("the team applies edits on DFY but doesn't connect, and has nothing on self-serve", async () => {
    expect(await canConnectBusiness(team.db, dfy.businessId)).toBe(false);
    expect(await canApplyEdits(team.db, dfy.businessId)).toBe(true);
    expect(await canConnectBusiness(team.db, f.businessId)).toBe(false);
    expect(await canApplyEdits(team.db, f.businessId)).toBe(false);
  });

  it("an outsider can do nothing", async () => {
    for (const b of [f.businessId, dfy.businessId]) {
      expect(await canConnectBusiness(outsider.db, b)).toBe(false);
      expect(await canApplyEdits(outsider.db, b)).toBe(false);
    }
  });
});

describe("reads", () => {
  it("members, the dfy_client and the team on DFY read connections and changes; others read nothing", async () => {
    const own = await connect(f.businessId, "gbp", "own-read");
    const d = await connect(dfy.businessId, "gbp", "dfy-read");
    await recordConnectionChange(svc(), {
      connectionId: d,
      actor: team.id,
      field: "description",
      before: { text: "Old" },
      after: { text: "New" },
      providerRef: "locations/1",
    });

    expect((await listConnections(owner.db, f.businessId)).map((c) => c.id)).toContain(own);
    for (const db of [client.db, team.db]) {
      expect((await listConnections(db, dfy.businessId)).map((c) => c.id)).toContain(d);
      expect((await listConnectionChanges(db, dfy.businessId)).map((c) => c.field)).toContain("description");
    }
    for (const db of [outsider.db, team.db, client.db]) expect(await listConnections(db, f.businessId)).toEqual([]);
    expect(await listConnections(outsider.db, dfy.businessId)).toEqual([]);
    expect(await listConnectionChanges(outsider.db, dfy.businessId)).toEqual([]);
  });
});

describe("tokens are unreadable by every user", () => {
  it("no user or anon reads connection_tokens or calls the token RPC", async () => {
    const id = await connect(f.businessId, "gbp", "secret");
    for (const db of [owner.db, team.db, client.db, outsider.db, anonClient()]) {
      const { data, error } = await loose(db).from("connection_tokens").select("*");
      expect(data ?? []).toEqual([]);
      expect(error?.code).toBe("42501");
      await expect(getConnectionTokens(db, id)).rejects.toMatchObject({ code: "42501" });
    }
    expect(await getConnectionTokens(svc(), id)).toMatchObject({ enc_refresh: "enc:v1:refresh-secret" });
  });
});

describe("no direct user writes", () => {
  it("users can't insert, update or delete connections, changes, tokens or interest", async () => {
    const id = await connect(f.businessId, "search_console", "direct");
    const tables: [string, Record<string, unknown>][] = [
      ["connections", { business_id: f.businessId, provider: "ga4", status: "connected" }],
      ["connection_changes", { connection_id: id, business_id: f.businessId, actor: owner.id, field: "description" }],
      ["connection_tokens", { connection_id: id, enc_access: "x" }],
      ["connector_interest", { business_id: f.businessId, provider: "yelp", user_id: owner.id }],
    ];
    for (const [table, row] of tables) {
      const ins = await loose(owner.db).from(table).insert(row);
      expect(ins.error?.code).toBe("42501");
    }
    const upd = await owner.db.from("connections").update({ status: "revoked" }).eq("id", id);
    expect(upd.error?.code).toBe("42501");
    const del = await owner.db.from("connections").delete().eq("id", id);
    expect(del.error?.code).toBe("42501");
  });

  it("users can't call the service RPCs (42501)", async () => {
    const id = await connect(f.businessId, "ga4", "rpc");
    for (const db of [owner.db, team.db, client.db]) {
      await expect(revokeConnection(db, id)).rejects.toMatchObject({ code: "42501" });
      await expect(setConnectionStatus(db, id, "needs_reauth")).rejects.toMatchObject({ code: "42501" });
      await expect(
        recordConnectionChange(db, {
          connectionId: id,
          actor: owner.id,
          field: "description",
          before: null,
          after: null,
        }),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        saveConnection(db, {
          businessId: f.businessId,
          provider: "gbp",
          externalAccountId: "x",
          scopes: [],
          connectedBy: owner.id,
          ...tokens("rpc"),
        }),
      ).rejects.toMatchObject({ code: "42501" });
    }
  });
});

describe("change log is append-only", () => {
  it("even the service role can't update or delete a change", async () => {
    const id = await connect(f.businessId, "gbp", "log");
    const change = await recordConnectionChange(svc(), {
      connectionId: id,
      actor: owner.id,
      field: "regular_hours",
      before: { mon: "11-21" },
      after: { mon: "11-22" },
      providerRef: "locations/9",
    });
    const upd = await svc().from("connection_changes").update({ field: "description" }).eq("id", change);
    expect(upd.error?.code).toBe("P0001");
    const del = await svc().from("connection_changes").delete().eq("id", change);
    expect(del.error?.code).toBe("P0001");
    expect(must(await svc().from("connection_changes").select("field").eq("id", change))).toEqual([
      { field: "regular_hours" },
    ]);
  });

  it("deleting the business removes its connections, tokens and changes", async () => {
    const x = await makeWorkspace(owner);
    const id = await connect(x.businessId, "gbp", "gone");
    await recordConnectionChange(svc(), {
      connectionId: id,
      actor: owner.id,
      field: "description",
      before: null,
      after: {},
    });
    must(await svc().from("businesses").delete().eq("id", x.businessId));
    expect(must(await svc().from("connections").select("id").eq("id", id))).toEqual([]);
    expect(must(await svc().from("connection_changes").select("id").eq("connection_id", id))).toEqual([]);
    expect(must(await svc().from("connection_tokens").select("connection_id").eq("connection_id", id))).toEqual([]);
  });

  it("gbp fields outside the allowlist, and a missing actor, are refused (22023)", async () => {
    const id = await connect(f.businessId, "gbp", "allow");
    for (const field of [
      "description",
      "regular_hours",
      "special_hours",
      "website_uri",
      "primary_phone",
      "attributes",
    ]) {
      await recordConnectionChange(svc(), { connectionId: id, actor: owner.id, field, before: null, after: {} });
    }
    for (const field of ["categories", "title", "reviews", "", "Description"]) {
      await expect(
        recordConnectionChange(svc(), { connectionId: id, actor: owner.id, field, before: null, after: {} }),
      ).rejects.toMatchObject({ code: "22023" });
    }
    await expect(
      recordConnectionChange(svc(), {
        connectionId: id,
        actor: null as unknown as string,
        field: "description",
        before: null,
        after: {},
      }),
    ).rejects.toMatchObject({ code: "22023" });
  });
});

describe("connect, reauth and revoke", () => {
  it("saving again keeps one connection per provider and replaces its tokens", async () => {
    const x = await makeWorkspace(owner);
    const first = await connect(x.businessId, "gbp", "one");
    const again = await connect(x.businessId, "gbp", "two");
    expect(again).toBe(first);
    expect(await getConnectionTokens(svc(), first)).toMatchObject({
      enc_access: "enc:v1:access-two",
      enc_refresh: "enc:v1:refresh-two",
      status: "connected",
    });
  });

  it("one Google grant: a new Google connector and a refresh update every Google connection's tokens", async () => {
    const x = await makeWorkspace(owner);
    const gbp = await connect(x.businessId, "gbp", "g1");
    const gsc = await connect(x.businessId, "search_console", "g2");
    expect((await getConnectionTokens(svc(), gbp))?.enc_refresh).toBe("enc:v1:refresh-g2");
    await updateConnectionTokens(svc(), gsc, { encAccess: "enc:v1:access-fresh", expiresAt: "2026-11-06T02:00:00Z" });
    for (const id of [gbp, gsc]) {
      expect(await getConnectionTokens(svc(), id)).toMatchObject({
        enc_access: "enc:v1:access-fresh",
        enc_refresh: "enc:v1:refresh-g2",
      });
    }
  });

  it("needs_reauth marks the whole Google grant, keeps the tokens, and a new consent reconnects", async () => {
    const x = await makeWorkspace(owner);
    const gbp = await connect(x.businessId, "gbp", "r1");
    const ga4 = await connect(x.businessId, "ga4", "r2");
    const shop = await connect(x.businessId, "shopify", "r3");
    await setConnectionStatus(svc(), gbp, "needs_reauth");
    const status = async () =>
      Object.fromEntries((await listConnections(owner.db, x.businessId)).map((c) => [c.provider, c.status]));
    expect(await status()).toEqual({ gbp: "needs_reauth", ga4: "needs_reauth", shopify: "connected" });
    expect((await getConnectionTokens(svc(), ga4))?.status).toBe("needs_reauth");
    await connect(x.businessId, "gbp", "r4");
    expect((await status()).gbp).toBe("connected");
    expect(await getConnectionTokens(svc(), shop)).not.toBeNull();
  });

  it("revoking one Google connection revokes gbp, search_console and ga4 and deletes their tokens; shopify is untouched", async () => {
    const x = await makeWorkspace(owner);
    const ids = [
      await connect(x.businessId, "gbp", "v1"),
      await connect(x.businessId, "search_console", "v2"),
      await connect(x.businessId, "ga4", "v3"),
    ];
    const shop = await connect(x.businessId, "shopify", "v4");
    expect((await revokeConnection(svc(), ids[1])).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(await getConnectionTokens(svc(), id)).toBeNull();
    expect(must(await svc().from("connection_tokens").select("connection_id").in("connection_id", ids))).toEqual([]);
    const rows = await listConnections(owner.db, x.businessId);
    expect(rows.filter((c) => c.provider !== "shopify").map((c) => c.status)).toEqual([
      "revoked",
      "revoked",
      "revoked",
    ]);
    expect(rows.find((c) => c.provider === "shopify")?.status).toBe("connected");
    expect((await getConnectionTokens(svc(), shop))?.enc_access).toBe("enc:v1:access-v4");
    expect(await revokeConnection(svc(), ids[0])).toEqual([]);
  });

  it("two Google accounts on one business are separate grants: revoking one leaves the other connected", async () => {
    const x = await makeWorkspace(owner);
    const gbp = await connect(x.businessId, "gbp", "a1", "google-sub-a");
    const ga4 = await connect(x.businessId, "ga4", "b1", "google-sub-b");
    expect((await getConnectionTokens(svc(), gbp))?.enc_refresh).toBe("enc:v1:refresh-a1");
    await setConnectionStatus(svc(), ga4, "needs_reauth");
    expect((await getConnectionTokens(svc(), gbp))?.status).toBe("connected");
    await setConnectionStatus(svc(), ga4, "connected");
    await updateConnectionTokens(svc(), gbp, { encAccess: "enc:v1:access-a2", expiresAt: null });
    expect((await getConnectionTokens(svc(), ga4))?.enc_access).toBe("enc:v1:access-b1");
    expect(await revokeConnection(svc(), gbp)).toEqual([gbp]);
    expect(await getConnectionTokens(svc(), ga4)).toEqual({
      enc_access: "enc:v1:access-b1",
      enc_refresh: "enc:v1:refresh-b1",
      expires_at: expect.any(String),
      status: "connected",
      external_account_id: "google-sub-b",
    });
  });

  it("connecting GA4 after GBP without a refresh token keeps it for both, but never takes another account's", async () => {
    const x = await makeWorkspace(owner);
    const gbp = await connect(x.businessId, "gbp", "n1");
    const save = (provider: "gbp" | "ga4", account: string) =>
      saveConnection(svc(), {
        businessId: x.businessId,
        provider,
        externalAccountId: account,
        scopes: [],
        connectedBy: owner.id,
        encAccess: "enc:v1:access-n2",
        encRefresh: null,
        expiresAt: null,
      });
    const ga4 = await save("ga4", "google-sub-example");
    for (const id of [gbp, ga4]) {
      expect(await getConnectionTokens(svc(), id)).toMatchObject({
        enc_access: "enc:v1:access-n2",
        enc_refresh: "enc:v1:refresh-n1",
      });
    }
    await save("gbp", "google-sub-example");
    expect((await getConnectionTokens(svc(), gbp))?.enc_refresh).toBe("enc:v1:refresh-n1");
    await save("gbp", "google-sub-other");
    expect((await getConnectionTokens(svc(), gbp))?.enc_refresh).toBeNull();
  });

  it("revoking shopify revokes only shopify", async () => {
    const x = await makeWorkspace(owner);
    const gbp = await connect(x.businessId, "gbp", "s1");
    const shop = await connect(x.businessId, "shopify", "s2");
    expect(await revokeConnection(svc(), shop)).toEqual([shop]);
    expect(await getConnectionTokens(svc(), shop)).toBeNull();
    expect((await getConnectionTokens(svc(), gbp))?.status).toBe("connected");
  });

  it("refuses an unknown provider or status (22023)", async () => {
    await expect(
      saveConnection(svc(), {
        businessId: f.businessId,
        provider: "yelp" as "gbp",
        externalAccountId: "x",
        scopes: [],
        connectedBy: owner.id,
        ...tokens("bad"),
      }),
    ).rejects.toMatchObject({ code: "22023" });
    const id = await connect(f.businessId, "gbp", "status");
    await expect(setConnectionStatus(svc(), id, "revoked" as "connected")).rejects.toMatchObject({ code: "22023" });
  });
});

describe("multi-entity picker", () => {
  it("stores the selected locations and refuses a non-array or more than 100 (22023)", async () => {
    const id = await connect(f.businessId, "gbp", "entities");
    const picked = [
      { id: "locations/1", name: "Example Ramen Irvine" },
      { id: "locations/2", name: "Example Ramen Tustin" },
    ];
    await setConnectionEntities(svc(), id, picked);
    expect((await listConnections(owner.db, f.businessId)).find((c) => c.id === id)?.selected_entities).toEqual(picked);
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `locations/${i}`, name: `Example ${i}` }));
    await expect(setConnectionEntities(svc(), id, many)).rejects.toMatchObject({ code: "22023" });
    await expect(
      setConnectionEntities(svc(), id, { id: "x" } as unknown as { id: string; name: string }[]),
    ).rejects.toMatchObject({ code: "22023" });
  });
});

describe("connector interest", () => {
  it("has the 13 connector keys (youtube since 0036)", () => {
    expect(CONNECTOR_KEYS).toHaveLength(13);
  });

  it("is idempotent per business, provider and user, readable by members and the team on DFY", async () => {
    await noteConnectorInterest(client.db, dfy.businessId, "yelp");
    await noteConnectorInterest(client.db, dfy.businessId, "yelp");
    await noteConnectorInterest(team.db, dfy.businessId, "yelp");
    const rows = await listConnectorInterest(team.db, dfy.businessId);
    expect(rows.filter((r) => r.provider === "yelp")).toHaveLength(2);
    expect(await listConnectorInterest(outsider.db, dfy.businessId)).toEqual([]);
  });

  it("refuses an unknown provider (22023) and an outsider or the team on self-serve (42501)", async () => {
    await expect(noteConnectorInterest(owner.db, f.businessId, "myspace" as "yelp")).rejects.toMatchObject({
      code: "22023",
    });
    for (const db of [outsider.db, team.db]) {
      await expect(noteConnectorInterest(db, f.businessId, "yelp")).rejects.toMatchObject({ code: "42501" });
    }
  });
});
