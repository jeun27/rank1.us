import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import {
  createBusinessOnboarding,
  createDfyClient,
  getOnboardingState,
  type OnboardingInput,
} from "@/lib/queries/onboarding";
import { listLocalPlaces } from "@/lib/queries/places";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;
const DENIED = "42501";
const CHECK = "23514";

const question = (i: number, extra: Partial<OnboardingInput["questions"][number]> = {}) => ({
  short_text: `best ramen in Irvine ${i}`,
  long_text: `Where can I get great ramen in Irvine, take ${i}?`,
  active_form: "long" as const,
  active: true,
  location_level: "city" as const,
  country: "US",
  state: "CA",
  city: "Irvine",
  template_key: String(i),
  ...extra,
});

const input = (extra: Partial<OnboardingInput> = {}): OnboardingInput => ({
  business: {
    name: "Example Ramen House",
    domain: "example-ramen.test",
    cuisine: "ramen",
    city: "Irvine",
    state: "CA",
    country: "US",
    aliases: ["Example Ramen"],
  },
  competitors: [
    { name: "Example Noodle Bar", domain: "example-noodle.test", rating: 4.4, maps_cid: "123", source: "maps" },
    { name: "Example Izakaya", source: "manual" },
  ],
  questions: Array.from({ length: 25 }, (_, i) => question(i + 1)),
  ...extra,
});

async function selfServe(tag: string) {
  const user = await newUser(tag);
  const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
  return { user, workspaceId };
}

async function withRole(tag: string, role: "team" | "dfy_client") {
  const user = await newUser(tag);
  must(await serviceClient().from("user_roles").insert({ user_id: user.id, role }));
  return user;
}

const rowsIn = async (workspaceId: string) => {
  const s = serviceClient();
  const businesses = must(await s.from("businesses").select("id").eq("workspace_id", workspaceId));
  const ids = businesses.map((b) => b.id);
  const competitors = must(await s.from("competitors").select("id").in("business_id", ids));
  const questions = must(await s.from("questions").select("id").in("business_id", ids));
  return { businesses: ids.length, competitors: competitors.length, questions: questions.length };
};

describe("seat rule", () => {
  const biz = (workspace_id: string, name: string, extra = {}) => ({ workspace_id, name, ...extra });

  it("0 seats: the first active business is allowed, the second is blocked (service role too)", async () => {
    const { user, workspaceId } = await selfServe("seats-0");
    must(await user.db.from("businesses").insert(biz(workspaceId, "Example One")));
    const second = await serviceClient().from("businesses").insert(biz(workspaceId, "Example Two"));
    expect(second.error?.message).toMatch(/no free seat/);
  });

  it("2 paid seats: two active businesses, not three", async () => {
    const { user, workspaceId } = await selfServe("seats-2");
    must(await serviceClient().from("workspaces").update({ seats_quantity: 2 }).eq("id", workspaceId));
    must(await user.db.from("businesses").insert([biz(workspaceId, "Example One"), biz(workspaceId, "Example Two")]));
    const third = await user.db.from("businesses").insert(biz(workspaceId, "Example Three"));
    expect(third.error?.message).toMatch(/no free seat/);
  });

  it("dfy businesses are exempt and do not take a seat", async () => {
    const { user, workspaceId } = await selfServe("seats-dfy");
    const s = serviceClient();
    must(
      await s
        .from("businesses")
        .insert([
          biz(workspaceId, "Example DFY 1", { service: "dfy" }),
          biz(workspaceId, "Example DFY 2", { service: "dfy" }),
        ]),
    );
    must(await user.db.from("businesses").insert(biz(workspaceId, "Example Self-serve")));
    must(await s.from("businesses").insert(biz(workspaceId, "Example DFY 3", { service: "dfy" })));
  });

  it("switching a dfy business to self_serve is blocked when seats are full", async () => {
    const { workspaceId } = await selfServe("seats-switch");
    const s = serviceClient();
    must(await s.from("businesses").insert(biz(workspaceId, "Example Self-serve")));
    const dfy = must(
      await s
        .from("businesses")
        .insert(biz(workspaceId, "Example DFY", { service: "dfy" }))
        .select()
        .single(),
    );
    const { error } = await s.from("businesses").update({ service: "self_serve" }).eq("id", dfy.id);
    expect(error?.message).toMatch(/no free seat/);
  });
});

describe("create_business_onboarding", () => {
  it("creates the business, competitors and questions in the caller's workspace", async () => {
    const { user, workspaceId } = await selfServe("onboard");
    const id = await createBusinessOnboarding(user.db, input());
    const s = serviceClient();
    const [business] = must(await s.from("businesses").select("*").eq("id", id));
    expect(business).toMatchObject({
      workspace_id: workspaceId,
      name: "Example Ramen House",
      domain: "example-ramen.test",
      cuisine: "ramen",
      vertical: "restaurant",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: ["Example Ramen"],
      service: "self_serve",
      fix_list_visible: false,
    });
    const competitors = must(
      await s.from("competitors").select("name, domain, rating, maps_cid, source").eq("business_id", id).order("name"),
    );
    expect(competitors).toEqual([
      { name: "Example Izakaya", domain: null, rating: null, maps_cid: null, source: "manual" },
      { name: "Example Noodle Bar", domain: "example-noodle.test", rating: 4.4, maps_cid: "123", source: "maps" },
    ]);
    const questions = must(
      await s.from("questions").select("active_form, active, location_level, city").eq("business_id", id),
    );
    expect(questions).toHaveLength(25);
    expect(
      questions.every(
        (q) => q.active_form === "long" && q.active && q.location_level === "city" && q.city === "Irvine",
      ),
    ).toBe(true);
  });

  it("ignores service and fix_list_visible smuggled into the input", async () => {
    const { user } = await selfServe("smuggle");
    const bad = input();
    Object.assign(bad.business, { service: "dfy", fix_list_visible: true, workspace_id: randomUUID() });
    const id = await createBusinessOnboarding(user.db, bad);
    const [business] = must(await serviceClient().from("businesses").select("service, fix_list_visible").eq("id", id));
    expect(business).toEqual({ service: "self_serve", fix_list_visible: false });
  });

  it("rejects more than 25 active questions and stores nothing", async () => {
    const { user, workspaceId } = await selfServe("too-many");
    const questions = [...input().questions, question(26)];
    await expect(createBusinessOnboarding(user.db, input({ questions }))).rejects.toMatchObject({ code: CHECK });
    expect(await rowsIn(workspaceId)).toEqual({ businesses: 0, competitors: 0, questions: 0 });
  });

  it("allows inactive questions beyond 25", async () => {
    const { user } = await selfServe("inactive");
    const questions = [...input().questions, question(26, { active: false })];
    const id = await createBusinessOnboarding(user.db, input({ questions }));
    expect(must(await serviceClient().from("questions").select("id").eq("business_id", id))).toHaveLength(26);
  });

  it("is atomic: a bad question rolls back the business and competitors", async () => {
    const { user, workspaceId } = await selfServe("atomic");
    const questions = [...input().questions.slice(0, 24), question(25, { location_level: "galaxy" as never })];
    await expect(createBusinessOnboarding(user.db, input({ questions }))).rejects.toMatchObject({ code: CHECK });
    expect(await rowsIn(workspaceId)).toEqual({ businesses: 0, competitors: 0, questions: 0 });
  });

  it("denies a caller with no workspace, and team or dfy_client users", async () => {
    const noWorkspace = await newUser("no-workspace");
    await expect(createBusinessOnboarding(noWorkspace.db, input())).rejects.toMatchObject({ code: DENIED });
    for (const role of ["team", "dfy_client"] as const) {
      const user = await withRole(`onboard-${role}`, role);
      await expect(createBusinessOnboarding(user.db, input())).rejects.toMatchObject({ code: DENIED });
    }
  });

  it("anon cannot call it", async () => {
    const { error } = await loose(anonClient()).rpc("create_business_onboarding", { p: input() });
    expect(error?.code).toBe(DENIED);
  });

  it("an unpaid workspace cannot onboard a second business", async () => {
    const { user } = await selfServe("second");
    await createBusinessOnboarding(user.db, input());
    await expect(createBusinessOnboarding(user.db, input())).rejects.toMatchObject({ code: CHECK });
  });
});

describe("create_dfy_client", () => {
  const dfyInput = {
    workspace_name: "Example Client Group",
    business: {
      name: "Example Pho Spot",
      domain: "example-pho.test",
      cuisine: "pho",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
  };

  it("a team user creates a client workspace and a hidden-fix-list dfy business", async () => {
    const team = await withRole("team-creator", "team");
    const { workspaceId, businessId } = await createDfyClient(team.db, dfyInput);
    const s = serviceClient();
    const [ws] = must(await s.from("workspaces").select("name, owner_id, seats_quantity").eq("id", workspaceId));
    expect(ws).toEqual({ name: "Example Client Group", owner_id: team.id, seats_quantity: 0 });
    const [biz] = must(
      await s.from("businesses").select("workspace_id, name, service, fix_list_visible").eq("id", businessId),
    );
    expect(biz).toEqual({
      workspace_id: workspaceId,
      name: "Example Pho Spot",
      service: "dfy",
      fix_list_visible: false,
    });
  });

  it("self-serve and dfy_client users are denied; anon too", async () => {
    const { user } = await selfServe("dfy-denied");
    await expect(createDfyClient(user.db, dfyInput)).rejects.toMatchObject({ code: DENIED });
    const client = await withRole("dfy-denied-client", "dfy_client");
    await expect(createDfyClient(client.db, dfyInput)).rejects.toMatchObject({ code: DENIED });
    const { error } = await loose(anonClient()).rpc("create_dfy_client", { p: dfyInput });
    expect(error?.code).toBe(DENIED);
  });
});

describe("fixes visibility and writes by role (closes #9)", () => {
  let team: TestUser;
  let client: TestUser;
  let dfyBusinessId: string;
  let fixId: string;

  const fix = (business_id: string, title: string) => ({ business_id, rule_key: "R1", size: "S", title });

  beforeAll(async () => {
    team = await withRole("fix-team", "team");
    client = await withRole("fix-client", "dfy_client");
    const s = serviceClient();
    must(
      await s.from("fix_rules").upsert(
        {
          key: "R1",
          grp: "restaurant",
          title: "Test rule",
          size: "S",
          cadence: "weekly",
          customer_copy: "Test copy",
        },
        { onConflict: "key", ignoreDuplicates: true },
      ),
    );
    const created = await createDfyClient(team.db, {
      workspace_name: "Example DFY Fixes",
      business: {
        name: "Example Udon House",
        domain: null,
        cuisine: "udon",
        city: "Irvine",
        state: "CA",
        country: "US",
        aliases: [],
      },
    });
    dfyBusinessId = created.businessId;
    must(
      await s
        .from("workspace_members")
        .insert({ workspace_id: created.workspaceId, user_id: client.id, role: "member" }),
    );
    fixId = must(await s.from("fixes").insert(fix(dfyBusinessId, "Fix profile")).select().single()).id;
  });

  it("a team member sees and updates dfy fixes while fix_list_visible is false", async () => {
    expect(must(await team.db.from("fixes").select("id").eq("business_id", dfyBusinessId))).toEqual([{ id: fixId }]);
    const updated = must(await team.db.from("fixes").update({ status: "doing" }).eq("id", fixId).select("status"));
    expect(updated).toEqual([{ status: "doing" }]);
    must(await team.db.from("fixes").insert(fix(dfyBusinessId, "Team-added fix")));
  });

  it("a dfy_client member cannot read while hidden, and can never write", async () => {
    expect(must(await client.db.from("fixes").select("id").eq("business_id", dfyBusinessId))).toEqual([]);
    must(await serviceClient().from("businesses").update({ fix_list_visible: true }).eq("id", dfyBusinessId));
    expect(must(await client.db.from("fixes").select("id").eq("id", fixId))).toEqual([{ id: fixId }]);

    const insert = await client.db.from("fixes").insert(fix(dfyBusinessId, "Client fix"));
    expect(insert.error?.code).toBe(DENIED);
    const update = await client.db.from("fixes").update({ status: "done" }).eq("id", fixId).select();
    expect(update.data ?? []).toEqual([]);
    const del = await client.db.from("fixes").delete().eq("id", fixId).select();
    expect(del.data ?? []).toEqual([]);
    const [row] = must(await serviceClient().from("fixes").select("status").eq("id", fixId));
    expect(row.status).toBe("doing");
    must(await serviceClient().from("businesses").update({ fix_list_visible: false }).eq("id", dfyBusinessId));
  });

  it("self-serve members still read and write their own fixes", async () => {
    const { user } = await selfServe("fix-self");
    const id = await createBusinessOnboarding(user.db, input());
    const created = must(await user.db.from("fixes").insert(fix(id, "Self fix")).select().single());
    must(await user.db.from("fixes").update({ status: "done" }).eq("id", created.id));
    expect(must(await user.db.from("fixes").select("status").eq("id", created.id))).toEqual([{ status: "done" }]);
    must(await user.db.from("fixes").delete().eq("id", created.id));
  });
});

describe("getOnboardingState", () => {
  it("tracks workspace and business", async () => {
    const user = await newUser("state");
    expect(await getOnboardingState(user.db)).toEqual({ workspaceId: null, hasActiveBusiness: false });
    const workspaceId = await ensureSelfServeWorkspace(user.db);
    expect(await getOnboardingState(user.db)).toEqual({ workspaceId, hasActiveBusiness: false });
    await createBusinessOnboarding(user.db, input());
    expect(await getOnboardingState(user.db)).toEqual({ workspaceId, hasActiveBusiness: true });
  });
});

describe("listLocalPlaces", () => {
  it("returns verified places for the city, by kind then name", async () => {
    const city = `Exampleville ${randomUUID().slice(0, 8)}`;
    must(
      await serviceClient()
        .from("local_places")
        .insert([
          { city, state: "CA", name: "Zeta Park", kind: "landmark", verified: true },
          { city, state: "CA", name: "Alpha Village", kind: "area", verified: true },
          { city, state: "CA", name: "Beta Plaza", kind: "landmark", verified: true },
          { city, state: "CA", name: "Unverified Spot", kind: "landmark", verified: false },
          { city, state: "NV", name: "Other State", kind: "landmark", verified: true },
        ]),
    );
    const { user } = await selfServe("places");
    expect(await listLocalPlaces(user.db, city, "CA")).toEqual([
      { name: "Alpha Village", kind: "area" },
      { name: "Beta Plaza", kind: "landmark" },
      { name: "Zeta Park", kind: "landmark" },
    ]);
  });
});
