import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import {
  inviteClient,
  listClientUsers,
  removeClient,
  setFixListVisible,
  type DeleteUserFn,
  type InviteFn,
} from "@/lib/queries/clients";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;

// CI's stack has no mail server, so the invite creates the auth user directly and records the call.
const sent: { email: string; redirectTo: string }[] = [];
const fakeInvite: InviteFn = async (email, redirectTo) => {
  sent.push({ email, redirectTo });
  const { data, error } = await serviceClient().auth.admin.createUser({ email });
  if (error) throw error;
  return { userId: data.user.id };
};

let team: TestUser;
let dfy: { workspaceId: string; businessId: string };
let otherDfy: { workspaceId: string; businessId: string };
let selfServe: { user: TestUser; businessId: string };

const dfyInput = (name: string, domain: string) => ({
  workspace_name: `${name} group`,
  business: { name, domain, cuisine: "pho", city: "Irvine", state: "CA", country: "US", aliases: [] },
});
const email = (tag: string) => `${tag}-${randomUUID()}@example.test`;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rank1.example.test/");
  team = await newUser("clients-team");
  must(await serviceClient().from("user_roles").insert({ user_id: team.id, role: "team" }));
  dfy = await createDfyClient(team.db, dfyInput("Example Pho Spot", "example-pho.test"));
  otherDfy = await createDfyClient(team.db, dfyInput("Example Banh Mi Bar", "example-banhmi.test"));
  const user = await newUser("clients-self");
  await ensureSelfServeWorkspace(user.db);
  const businessId = await createBusinessOnboarding(user.db, {
    business: {
      name: "Example Ramen House",
      domain: "example-ramen.test",
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
    competitors: [],
    questions: [],
  });
  selfServe = { user, businessId };
});
afterAll(() => vi.unstubAllEnvs());

const userIdOf = async (address: string) => {
  const { data } = await serviceClient().auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email === address)?.id;
};

describe("inviteClient", () => {
  it("invites a new email: sends the invite with the callback URL and grants the client role + membership", async () => {
    const address = email("client-new");
    sent.length = 0;
    expect(
      await inviteClient(
        serviceClient(),
        { email: ` ${address.toUpperCase()} `, businessId: dfy.businessId },
        fakeInvite,
      ),
    ).toEqual({ status: "invited" });
    expect(sent).toEqual([{ email: address, redirectTo: "https://rank1.example.test/auth/callback" }]);

    const id = (await userIdOf(address))!;
    const s = serviceClient();
    expect(must(await s.from("user_roles").select("role").eq("user_id", id))).toEqual([{ role: "dfy_client" }]);
    expect(must(await s.from("workspace_members").select("workspace_id, role").eq("user_id", id))).toEqual([
      { workspace_id: dfy.workspaceId, role: "member" },
    ]);
    const clients = await listClientUsers(team.db, dfy.businessId);
    expect(clients.find((c) => c.user_id === id)).toMatchObject({ email: address, signed_in: false });
  });

  it("says 'already invited' for this business's client, without a second invite", async () => {
    const address = email("client-twice");
    await inviteClient(serviceClient(), { email: address, businessId: dfy.businessId }, fakeInvite);
    sent.length = 0;
    expect(await inviteClient(serviceClient(), { email: address, businessId: dfy.businessId }, fakeInvite)).toEqual({
      status: "already_invited",
    });
    expect(sent).toEqual([]);
  });

  it("refuses any existing account and changes nothing (self-serve, team, another business's client)", async () => {
    const otherClient = email("client-other");
    await inviteClient(serviceClient(), { email: otherClient, businessId: otherDfy.businessId }, fakeInvite);
    const s = serviceClient();
    for (const address of [selfServe.user.email, team.email, otherClient]) {
      const id = (await userIdOf(address))!;
      const before = {
        roles: must(await s.from("user_roles").select("role").eq("user_id", id)),
        members: must(await s.from("workspace_members").select("workspace_id, role").eq("user_id", id)),
      };
      sent.length = 0;
      expect(await inviteClient(s, { email: address, businessId: dfy.businessId }, fakeInvite)).toEqual({
        status: "existing_account",
      });
      expect(sent).toEqual([]);
      expect({
        roles: must(await s.from("user_roles").select("role").eq("user_id", id)),
        members: must(await s.from("workspace_members").select("workspace_id, role").eq("user_id", id)),
      }).toEqual(before);
    }
  });

  it("a failed grant deletes the just-invited user and returns error, so a retry starts clean", async () => {
    const address = email("client-grant-fails");
    const deleted: string[] = [];
    const recordDelete: DeleteUserFn = async (userId) => {
      deleted.push(userId);
      const { error } = await serviceClient().auth.admin.deleteUser(userId);
      if (error) throw error;
    };
    // The invitee ends up in another workspace before the grant, so grant_dfy_client refuses (22023).
    const inviteThenConflict: InviteFn = async (e, r) => {
      const { userId } = await fakeInvite(e, r);
      must(
        await serviceClient()
          .from("workspace_members")
          .insert({ workspace_id: otherDfy.workspaceId, user_id: userId, role: "member" }),
      );
      return { userId };
    };
    expect(
      await inviteClient(
        serviceClient(),
        { email: address, businessId: dfy.businessId },
        inviteThenConflict,
        recordDelete,
      ),
    ).toEqual({ status: "error" });
    expect(deleted).toHaveLength(1);
    expect(await userIdOf(address)).toBeUndefined();
    expect(must(await serviceClient().from("workspace_members").select("user_id").eq("user_id", deleted[0]))).toEqual(
      [],
    );

    expect(await inviteClient(serviceClient(), { email: address, businessId: dfy.businessId }, fakeInvite)).toEqual({
      status: "invited",
    });
    const id = (await userIdOf(address))!;
    expect(must(await serviceClient().from("workspace_members").select("workspace_id").eq("user_id", id))).toEqual([
      { workspace_id: dfy.workspaceId },
    ]);
  });

  it("a failed invite returns error and creates nothing", async () => {
    const address = email("client-invite-fails");
    const failing: InviteFn = async () => {
      throw new Error("Invite failed (500)");
    };
    expect(await inviteClient(serviceClient(), { email: address, businessId: dfy.businessId }, failing)).toEqual({
      status: "error",
    });
    expect(await userIdOf(address)).toBeUndefined();
  });

  it("rejects an invalid email, and a self-serve business (22023)", async () => {
    expect(
      await inviteClient(serviceClient(), { email: "not an email", businessId: dfy.businessId }, fakeInvite),
    ).toEqual({ status: "invalid_email" });
    await expect(
      inviteClient(serviceClient(), { email: email("client-ss"), businessId: selfServe.businessId }, fakeInvite),
    ).rejects.toMatchObject({ code: "22023" });
  });
});

describe("grant_dfy_client", () => {
  it("is idempotent and refuses team users, other workspaces' members and self-serve businesses", async () => {
    const s = serviceClient();
    const fresh = await newUser("grant-fresh");
    const grant = (userId: string, businessId: string) =>
      loose(s).rpc("grant_dfy_client", { p_user_id: userId, p_business_id: businessId });
    expect((await grant(fresh.id, dfy.businessId)).data).toBe("granted");
    expect((await grant(fresh.id, dfy.businessId)).data).toBe("already");
    expect(must(await s.from("workspace_members").select("role").eq("user_id", fresh.id))).toEqual([
      { role: "member" },
    ]);

    expect((await grant(team.id, dfy.businessId)).error?.code).toBe("22023");
    expect((await grant(selfServe.user.id, dfy.businessId)).error?.code).toBe("22023");
    expect((await grant(fresh.id, otherDfy.businessId)).error?.code).toBe("22023");
    const another = await newUser("grant-ss");
    expect((await grant(another.id, selfServe.businessId)).error?.code).toBe("22023");
    expect((await grant(randomUUID(), dfy.businessId)).error?.code).toBe("22023");
  });

  it("refuses every non-service caller (42501)", async () => {
    const callers = [team.db, selfServe.user.db, anonClient()];
    for (const db of callers) {
      for (const [fn, args] of [
        ["grant_dfy_client", { p_user_id: team.id, p_business_id: dfy.businessId }],
        ["revoke_dfy_client", { p_user_id: team.id, p_business_id: dfy.businessId }],
        ["client_invite_status", { p_email: "x@example.test", p_business_id: dfy.businessId }],
      ] as const) {
        expect((await loose(db).rpc(fn, args)).error?.code, fn).toBe("42501");
      }
    }
  });
});

describe("revoke and client isolation", () => {
  it("a client sees only their workspace; removing access removes read access, keeping the role", async () => {
    const address = email("client-revoke");
    const password = randomUUID();
    await inviteClient(serviceClient(), { email: address, businessId: dfy.businessId }, async (e, r) => {
      sent.push({ email: e, redirectTo: r });
      const { data, error } = await serviceClient().auth.admin.createUser({ email: e, password, email_confirm: true });
      if (error) throw error;
      return { userId: data.user.id };
    });
    const client = anonClient();
    const signIn = await client.auth.signInWithPassword({ email: address, password });
    if (signIn.error) throw signIn.error;
    const id = (await userIdOf(address))!;

    expect(must(await client.from("businesses").select("id"))).toEqual([{ id: dfy.businessId }]);
    expect(must(await client.from("businesses").select("id").eq("id", otherDfy.businessId))).toEqual([]);
    expect(must(await client.from("businesses").select("id").eq("id", selfServe.businessId))).toEqual([]);

    expect(await removeClient(serviceClient(), { userId: id, businessId: dfy.businessId })).toBe(true);
    expect(await removeClient(serviceClient(), { userId: id, businessId: dfy.businessId })).toBe(false);
    expect(must(await client.from("businesses").select("id"))).toEqual([]);
    expect(must(await serviceClient().from("user_roles").select("role").eq("user_id", id))).toEqual([
      { role: "dfy_client" },
    ]);
    expect((await listClientUsers(team.db, dfy.businessId)).map((c) => c.user_id)).not.toContain(id);
  });

  it("removeClient never removes the workspace owner", async () => {
    const owner = must(await serviceClient().from("workspaces").select("owner_id").eq("id", dfy.workspaceId).single());
    expect(await removeClient(serviceClient(), { userId: owner.owner_id, businessId: dfy.businessId })).toBe(false);
    expect(
      must(
        await serviceClient()
          .from("workspace_members")
          .select("role")
          .eq("user_id", owner.owner_id)
          .eq("workspace_id", dfy.workspaceId),
      ),
    ).toEqual([{ role: "owner" }]);
  });
});

describe("team-only paths", () => {
  it("set_fix_list_visible toggles for team, and refuses self-serve, dfy_client and anon (42501)", async () => {
    await setFixListVisible(team.db, dfy.businessId, true);
    expect(
      must(await serviceClient().from("businesses").select("fix_list_visible").eq("id", dfy.businessId).single())
        .fix_list_visible,
    ).toBe(true);
    await setFixListVisible(team.db, dfy.businessId, false);
    expect(
      must(await serviceClient().from("businesses").select("fix_list_visible").eq("id", dfy.businessId).single())
        .fix_list_visible,
    ).toBe(false);

    const address = email("client-toggle");
    const password = randomUUID();
    await inviteClient(serviceClient(), { email: address, businessId: dfy.businessId }, async (e) => {
      const { data, error } = await serviceClient().auth.admin.createUser({ email: e, password, email_confirm: true });
      if (error) throw error;
      return { userId: data.user.id };
    });
    const client = anonClient();
    const signIn = await client.auth.signInWithPassword({ email: address, password });
    if (signIn.error) throw signIn.error;

    for (const db of [selfServe.user.db, client, anonClient()]) {
      await expect(setFixListVisible(db, dfy.businessId, true)).rejects.toMatchObject({ code: "42501" });
      await expect(listClientUsers(db, dfy.businessId)).rejects.toMatchObject({ code: "42501" });
    }
    await expect(setFixListVisible(team.db, selfServe.businessId, true)).rejects.toMatchObject({ code: "42501" });
    await expect(listClientUsers(team.db, selfServe.businessId)).rejects.toMatchObject({ code: "42501" });
    expect(
      must(await serviceClient().from("businesses").select("fix_list_visible").eq("id", dfy.businessId).single())
        .fix_list_visible,
    ).toBe(false);
  });
});
