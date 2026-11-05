import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace, getLanding } from "@/lib/queries/auth";
import { anonClient, dbUrl, makeWorkspace, must, newUser, serviceClient, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;
const RLS_DENIED = "42501";

let team: TestUser;
let dfy: TestUser;

async function ownedWorkspaces(userId: string) {
  return must(await serviceClient().from("workspaces").select("id, name").eq("owner_id", userId));
}
async function memberships(userId: string) {
  return must(await serviceClient().from("workspace_members").select("workspace_id, role").eq("user_id", userId));
}

beforeAll(async () => {
  team = await newUser("team");
  dfy = await newUser("dfy-client");
  must(
    await serviceClient()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: dfy.id, role: "dfy_client" },
      ]),
  );
});

describe("user_roles", () => {
  it("a user reads only their own row", async () => {
    expect(must(await team.db.from("user_roles").select("user_id, role"))).toEqual([
      { user_id: team.id, role: "team" },
    ]);
    expect(must(await team.db.from("user_roles").select("user_id").eq("user_id", dfy.id))).toEqual([]);
    const selfServe = await newUser("no-role");
    expect(must(await selfServe.db.from("user_roles").select("user_id"))).toEqual([]);
  });

  it("anon reads nothing", async () => {
    const { data, error } = await loose(anonClient()).from("user_roles").select("*");
    if (error) expect(error.code).toBe(RLS_DENIED);
    else expect(data).toEqual([]);
  });

  it("authenticated users cannot insert, update or delete roles", async () => {
    const selfServe = await newUser("climber");
    const insert = await loose(selfServe.db).from("user_roles").insert({ user_id: selfServe.id, role: "team" });
    expect(insert.error?.code).toBe(RLS_DENIED);

    await loose(dfy.db).from("user_roles").update({ role: "team" }).eq("user_id", dfy.id);
    await loose(dfy.db).from("user_roles").delete().eq("user_id", dfy.id);
    expect(must(await serviceClient().from("user_roles").select("role").eq("user_id", dfy.id))).toEqual([
      { role: "dfy_client" },
    ]);
    expect(must(await serviceClient().from("user_roles").select("role").eq("user_id", selfServe.id))).toEqual([]);
  });
});

describe("ensure_self_serve_workspace", () => {
  it("first call creates exactly one workspace with the user as owner; the second returns the same id", async () => {
    const user = await newUser("first");
    const id = await ensureSelfServeWorkspace(user.db);
    expect(id).toEqual(expect.any(String));
    expect(await ownedWorkspaces(user.id)).toEqual([{ id, name: `${user.email.split("@")[0]}'s workspace` }]);
    expect(await memberships(user.id)).toEqual([{ workspace_id: id, role: "owner" }]);

    expect(await ensureSelfServeWorkspace(user.db)).toBe(id);
    expect(await ownedWorkspaces(user.id)).toHaveLength(1);
  });

  it("parallel first calls still create one workspace", async () => {
    const user = await newUser("parallel");
    const ids = await Promise.all(Array.from({ length: 5 }, () => ensureSelfServeWorkspace(user.db)));
    expect(new Set(ids).size).toBe(1);
    expect(await ownedWorkspaces(user.id)).toHaveLength(1);
    expect(await memberships(user.id)).toHaveLength(1);
  });

  it("returns the workspace a user already belongs to instead of creating one", async () => {
    const owner = await newUser("inviter");
    const fixture = await makeWorkspace(owner);
    const invited = await newUser("invited");
    must(
      await serviceClient()
        .from("workspace_members")
        .insert({ workspace_id: fixture.workspaceId, user_id: invited.id, role: "member" }),
    );
    expect(await ensureSelfServeWorkspace(invited.db)).toBe(fixture.workspaceId);
    expect(await ownedWorkspaces(invited.id)).toEqual([]);
  });

  it("names the workspace 'My workspace' when the user has no email", async () => {
    const user = await newUser("no-email");
    const pg = new Client({ connectionString: dbUrl() });
    await pg.connect();
    await pg.query("update auth.users set email = null where id = $1", [user.id]);
    await pg.end();
    const id = await ensureSelfServeWorkspace(user.db);
    expect(await ownedWorkspaces(user.id)).toEqual([{ id, name: "My workspace" }]);
  });

  it("team and dfy_client users get null and no workspace", async () => {
    expect(await ensureSelfServeWorkspace(team.db)).toBeNull();
    expect(await ensureSelfServeWorkspace(dfy.db)).toBeNull();
    for (const u of [team, dfy]) {
      expect(await ownedWorkspaces(u.id)).toEqual([]);
      expect(await memberships(u.id)).toEqual([]);
    }
  });

  it("the HANDOFF seeding flow: create user, insert role, then first sign-in gets null and no workspace", async () => {
    const s = serviceClient();
    const email = `seeded-team-${randomUUID()}@example.test`;
    const password = randomUUID();
    const created = await s.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    const userId = created.data.user.id;
    must(await s.from("user_roles").insert({ user_id: userId, role: "team" }));

    const db = anonClient();
    const signIn = await db.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    expect(await ensureSelfServeWorkspace(db)).toBeNull();
    expect(await getLanding(db)).toBe("team");
    expect(await ownedWorkspaces(userId)).toEqual([]);
    expect(await memberships(userId)).toEqual([]);
  });

  it("anon cannot call it", async () => {
    const { error } = await anonClient().rpc("ensure_self_serve_workspace");
    expect(error?.code).toBe(RLS_DENIED);
  });
});

describe("my_landing", () => {
  it("routes team and dfy_client users by role", async () => {
    expect(await getLanding(team.db)).toBe("team");
    expect(await getLanding(dfy.db)).toBe("dfy_client");
  });

  it("self-serve: onboarding without an active business, dashboard with one", async () => {
    const user = await newUser("landing");
    const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
    expect(await getLanding(user.db)).toBe("onboarding");

    const s = serviceClient();
    must(await s.from("workspaces").update({ seats_quantity: 1 }).eq("id", workspaceId));
    const biz = must(
      await s.from("businesses").insert({ workspace_id: workspaceId, name: "Example Ramen House" }).select().single(),
    );
    expect(await getLanding(user.db)).toBe("dashboard");

    must(await s.from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", biz.id));
    expect(await getLanding(user.db)).toBe("onboarding");
  });

  it("anon cannot call it", async () => {
    const { error } = await anonClient().rpc("my_landing");
    expect(error?.code).toBe(RLS_DENIED);
  });
});
