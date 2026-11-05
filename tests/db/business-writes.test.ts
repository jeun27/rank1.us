import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { setReportSettings } from "@/lib/queries/reports";
import { must, newUser, serviceClient, type TestUser } from "./helpers";

// Step 16 businesses write gate: RLS writes for self-serve members only; the team changes a DFY
// business only through definer RPCs; a dfy_client never writes; id/workspace_id/service are service-only.
const loose = (db: unknown) => db as SupabaseClient;
const business = {
  name: "Example Ramen House",
  domain: "example-ramen.test",
  cuisine: "ramen",
  city: "Irvine",
  state: "CA",
  country: "US",
  aliases: [],
};

let owner: TestUser;
let ownerWorkspace: string;
let ownerBusiness: string;
let team: TestUser;
let client: TestUser;
let dfy: { workspaceId: string; businessId: string };

const row = async (id: string) =>
  must(await serviceClient().from("businesses").select("name, brand_color").eq("id", id).single());

beforeAll(async () => {
  owner = await newUser("bw-owner");
  ownerWorkspace = (await ensureSelfServeWorkspace(owner.db))!;
  ownerBusiness = await createBusinessOnboarding(owner.db, { business, competitors: [], questions: [] });
  must(await serviceClient().from("workspaces").update({ seats_quantity: 3 }).eq("id", ownerWorkspace));

  team = await newUser("bw-team");
  client = await newUser("bw-client");
  must(
    await serviceClient()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
  const creator = await newUser("bw-creator");
  must(await serviceClient().from("user_roles").insert({ user_id: creator.id, role: "team" }));
  dfy = await createDfyClient(creator.db, {
    workspace_name: "Example DFY",
    business: { ...business, name: "Example Pho Spot" },
  });
  must(
    await serviceClient()
      .from("workspace_members")
      .insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
  );
});

describe("businesses write gate", () => {
  it("self-serve members insert, update and delete their own businesses", async () => {
    must(
      await owner.db
        .from("businesses")
        .update({ name: "Example Renamed", brand_color: "#3A6B5C" })
        .eq("id", ownerBusiness),
    );
    expect(await row(ownerBusiness)).toEqual({ name: "Example Renamed", brand_color: "#3A6B5C" });
    const extra = must(
      await owner.db
        .from("businesses")
        .insert({ workspace_id: ownerWorkspace, name: "Example Second" })
        .select("id")
        .single(),
    );
    must(await owner.db.from("businesses").delete().eq("id", extra.id));
    expect(must(await serviceClient().from("businesses").select("id").eq("id", extra.id))).toEqual([]);
  });

  it("a dfy_client can read but never update, delete or insert into its DFY workspace", async () => {
    expect(must(await client.db.from("businesses").select("id").eq("id", dfy.businessId))).toEqual([
      { id: dfy.businessId },
    ]);
    const before = await row(dfy.businessId);
    const update = await client.db
      .from("businesses")
      .update({ name: "Hacked", brand_color: "#000000" })
      .eq("id", dfy.businessId)
      .select();
    expect(update.data ?? []).toEqual([]);
    const del = await client.db.from("businesses").delete().eq("id", dfy.businessId).select();
    expect(del.data ?? []).toEqual([]);
    expect(await row(dfy.businessId)).toEqual(before);
    const insert = await loose(client.db)
      .from("businesses")
      .insert({ workspace_id: dfy.workspaceId, name: "Example Sneaky" });
    expect(insert.error?.code).toBe("42501");
  });

  it("the team can't edit, move or delete a DFY business directly, only set report settings via the RPC", async () => {
    const before = await row(dfy.businessId);
    const direct = await team.db
      .from("businesses")
      .update({ brand_color: "#112233" })
      .eq("id", dfy.businessId)
      .select();
    expect(direct.data ?? []).toEqual([]);
    const move = await loose(team.db)
      .from("businesses")
      .update({ workspace_id: ownerWorkspace })
      .eq("id", dfy.businessId);
    expect(move.error?.code).toBe("42501");
    const del = await team.db.from("businesses").delete().eq("id", dfy.businessId).select();
    expect(del.data ?? []).toEqual([]);
    expect(await row(dfy.businessId)).toEqual(before);
    expect(
      must(await serviceClient().from("businesses").select("workspace_id").eq("id", dfy.businessId).single())
        .workspace_id,
    ).toBe(dfy.workspaceId);

    await setReportSettings(team.db, dfy.businessId, {
      brand_color: "#112233",
      report_recipients: ["Client@Example.test"],
    });
    expect(
      must(
        await serviceClient()
          .from("businesses")
          .select("brand_color, report_recipients")
          .eq("id", dfy.businessId)
          .single(),
      ),
    ).toEqual({
      brand_color: "#112233",
      report_recipients: ["client@example.test"],
    });
  });

  it("the team never changes a self-serve business", async () => {
    const before = await row(ownerBusiness);
    const update = await team.db.from("businesses").update({ name: "Team was here" }).eq("id", ownerBusiness).select();
    expect(update.data ?? []).toEqual([]);
    await expect(setReportSettings(team.db, ownerBusiness, { brand_color: "#000000" })).rejects.toMatchObject({
      code: "42501",
    });
    expect(await row(ownerBusiness)).toEqual(before);
  });

  it("a self-serve member can't change workspace_id, service or id", async () => {
    const other = await newUser("bw-other");
    const otherWorkspace = (await ensureSelfServeWorkspace(other.db))!;
    for (const patch of [{ workspace_id: otherWorkspace }, { service: "dfy" }, { id: crypto.randomUUID() }]) {
      const { error } = await loose(owner.db).from("businesses").update(patch).eq("id", ownerBusiness);
      expect(error?.code, JSON.stringify(Object.keys(patch))).toBe("42501");
    }
    expect(
      must(await serviceClient().from("businesses").select("workspace_id, service").eq("id", ownerBusiness).single()),
    ).toEqual({
      workspace_id: ownerWorkspace,
      service: "self_serve",
    });
  });

  it("a dfy_client can't set report settings through the RPC either", async () => {
    await expect(setReportSettings(client.db, dfy.businessId, { brand_color: "#000000" })).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("a stranger changes nothing", async () => {
    const stranger = await newUser("bw-stranger");
    const update = await stranger.db.from("businesses").update({ name: "x" }).eq("id", ownerBusiness).select();
    expect(update.data ?? []).toEqual([]);
    const insert = await loose(stranger.db).from("businesses").insert({ workspace_id: ownerWorkspace, name: "x" });
    expect(insert.error?.code).toBe("42501");
  });
});
