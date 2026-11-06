import { beforeAll, describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { revokeConnection, saveConnection } from "@/lib/queries/connections";
import { recordFixResults, setFixStatus } from "@/lib/queries/fixes";
import { dismissGasReady, getGasReady, refreshGasReady } from "@/lib/queries/gas-ready";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { must, newUser, serviceClient, type TestUser } from "./helpers";

// G3 (0027) "Ready for GAS": set the first time every Recommended connection is connected,
// cleared (with its dismissal) when one drops. recommend.ts passes the Recommended providers.
const s = () => serviceClient();

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
let ownerBusiness: string;
let team: TestUser;
let client: TestUser;
let outsider: TestUser;

const connect = (businessId: string, provider: "gbp" | "search_console" | "ga4") =>
  saveConnection(s(), {
    businessId,
    provider,
    externalAccountId: "google-sub-example",
    scopes: [],
    connectedBy: owner.id,
    encAccess: "enc:v1:a",
    encRefresh: "enc:v1:r",
    expiresAt: null,
  });

const columns = async (id: string) =>
  must(await s().from("businesses").select("gas_ready_at, gas_ready_dismissed_at").eq("id", id).single());

async function dfyBusiness() {
  const creator = await newUser("gas-creator");
  must(await s().from("user_roles").insert({ user_id: creator.id, role: "team" }));
  const dfy = await createDfyClient(creator.db, {
    workspace_name: "Example DFY",
    business: { ...business, name: "Example Pho" },
  });
  must(
    await s().from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
  );
  return dfy.businessId;
}

beforeAll(async () => {
  owner = await newUser("gas-owner");
  await ensureSelfServeWorkspace(owner.db);
  ownerBusiness = await createBusinessOnboarding(owner.db, { business, competitors: [], questions: [] });
  team = await newUser("gas-team");
  client = await newUser("gas-client");
  outsider = await newUser("gas-outsider");
  must(
    await s()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
});

describe("refresh_gas_ready", () => {
  it("is never ready with no Recommended providers", async () => {
    expect(await refreshGasReady(s(), ownerBusiness, [])).toEqual({ ready: false, newlyReady: false });
    expect(await columns(ownerBusiness)).toEqual({ gas_ready_at: null, gas_ready_dismissed_at: null });
  });

  it("is ready once every Recommended provider is connected, and newly ready only once", async () => {
    const b = await dfyBusiness();
    expect(await refreshGasReady(s(), b, ["gbp", "search_console"])).toEqual({ ready: false, newlyReady: false });
    await connect(b, "gbp");
    expect(await refreshGasReady(s(), b, ["gbp"])).toEqual({ ready: true, newlyReady: true });
    const first = (await columns(b)).gas_ready_at;
    expect(first).not.toBeNull();
    expect(await refreshGasReady(s(), b, ["gbp"])).toEqual({ ready: true, newlyReady: false });
    expect((await columns(b)).gas_ready_at).toBe(first);
    expect(await refreshGasReady(s(), b, ["gbp", "search_console"])).toEqual({ ready: false, newlyReady: false });
    expect(await columns(b)).toEqual({ gas_ready_at: null, gas_ready_dismissed_at: null });
    await connect(b, "search_console");
    expect(await refreshGasReady(s(), b, ["gbp", "search_console"])).toEqual({ ready: true, newlyReady: true });
  });

  it("when readiness drops it also clears the dismissal, so the next ready shows the notice again", async () => {
    const b = await dfyBusiness();
    const gbp = await connect(b, "gbp");
    await refreshGasReady(s(), b, ["gbp"]);
    await dismissGasReady(team.db, b);
    expect(await getGasReady(team.db, b)).toMatchObject({ showNotice: false });
    expect((await columns(b)).gas_ready_dismissed_at).not.toBeNull();

    await revokeConnection(s(), gbp);
    expect(await refreshGasReady(s(), b, ["gbp"])).toEqual({ ready: false, newlyReady: false });
    expect(await columns(b)).toEqual({ gas_ready_at: null, gas_ready_dismissed_at: null });

    await connect(b, "gbp");
    expect(await refreshGasReady(s(), b, ["gbp"])).toEqual({ ready: true, newlyReady: true });
    expect(await getGasReady(team.db, b)).toMatchObject({ showNotice: true });
  });

  it("refuses users (42501) and an unknown provider (22023)", async () => {
    for (const db of [owner.db, team.db]) {
      await expect(refreshGasReady(db, ownerBusiness, ["gbp"])).rejects.toMatchObject({ code: "42501" });
    }
    await expect(refreshGasReady(s(), ownerBusiness, ["myspace"])).rejects.toMatchObject({ code: "22023" });
  });

  it("members can't write the ready columns directly", async () => {
    const { error } = await owner.db
      .from("businesses")
      .update({ gas_ready_at: new Date().toISOString() })
      .eq("id", ownerBusiness);
    expect(error?.code).toBe("42501");
  });
});

describe("the ready notice", () => {
  it("shows to the team and the client until the team moves a fix after ready", async () => {
    const b = await dfyBusiness();
    await connect(b, "gbp");
    await refreshGasReady(s(), b, ["gbp"]);
    for (const db of [team.db, client.db]) {
      expect(await getGasReady(db, b)).toMatchObject({ readyAt: expect.any(String), showNotice: true });
    }
    const run = must(
      await s()
        .from("runs")
        .insert({ business_id: b, kind: "weekly", status: "complete", started_at: new Date().toISOString() })
        .select("id")
        .single(),
    ).id;
    must(
      await s().from("fix_rules").upsert(
        {
          key: "R10",
          grp: "restaurant",
          title: "Rule R10",
          size: "M-L",
          cadence: "weekly",
          customer_copy: "Copy",
          enabled: true,
        },
        { onConflict: "key", ignoreDuplicates: true },
      ),
    );
    await recordFixResults(s(), b, run, [{ rule_key: "R10", result: "fix", evidence: null, detail: "Detail" }]);
    const fix = must(await s().from("fixes").select("id").eq("business_id", b).eq("rule_key", "R10").single()).id;
    await setFixStatus(team.db, fix, "doing");
    for (const db of [team.db, client.db]) expect(await getGasReady(db, b)).toMatchObject({ showNotice: false });
  });

  it("only the team on DFY can dismiss it (42501 otherwise); outsiders read nothing", async () => {
    const b = await dfyBusiness();
    await connect(b, "gbp");
    await refreshGasReady(s(), b, ["gbp"]);
    for (const db of [client.db, outsider.db]) {
      await expect(dismissGasReady(db, b)).rejects.toMatchObject({ code: "42501" });
    }
    await expect(dismissGasReady(team.db, ownerBusiness)).rejects.toMatchObject({ code: "42501" });
    expect(await getGasReady(outsider.db, b)).toBeNull();
    expect(await getGasReady(team.db, ownerBusiness)).toBeNull();
    expect(await getGasReady(owner.db, ownerBusiness)).toEqual({ readyAt: null, showNotice: false });
  });
});
