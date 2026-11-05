import { Client } from "pg";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbUrl, makeWorkspace, must, newUser, serviceClient, type Fixture, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;
const RLS_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const NOT_NULL_VIOLATION = "23502";

const contact = (extra: Record<string, unknown>) =>
  loose(serviceClient()).from("contact_requests").insert({ name: "Ana Example", email: "ana@example.test", ...extra }).select().single();

describe("#22 contact_requests.industry", () => {
  for (const industry of ["Restaurant", "HVAC", "Plumbing", "Roofing", "Pest control", "Other"]) {
    it(`accepts ${industry}`, async () => {
      const row = must(await contact({ industry }));
      expect(row.industry).toBe(industry);
      expect(row.industry_other).toBeNull();
    });
  }

  it("rejects an industry outside the list", async () => {
    expect((await contact({ industry: "Dental" })).error?.code).toBe(CHECK_VIOLATION);
    expect((await contact({ industry: "restaurant" })).error?.code).toBe(CHECK_VIOLATION);
  });

  it("requires an industry (the backfill default is gone)", async () => {
    expect((await contact({})).error?.code).toBe(NOT_NULL_VIOLATION);
    const pg = new Client({ connectionString: dbUrl() });
    await pg.connect();
    const { rows } = await pg.query(
      `select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'contact_requests' and column_name = 'industry'`,
    );
    await pg.end();
    expect(rows).toEqual([{ column_default: null }]);
  });

  it("allows industry_other up to 60 characters with Other", async () => {
    expect(must(await contact({ industry: "Other", industry_other: "Bakery" })).industry_other).toBe("Bakery");
    expect(must(await contact({ industry: "Other", industry_other: "x".repeat(60) })).industry_other).toHaveLength(60);
    expect((await contact({ industry: "Other", industry_other: "x".repeat(61) })).error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects industry_other unless industry is Other", async () => {
    expect((await contact({ industry: "Restaurant", industry_other: "Bakery" })).error?.code).toBe(CHECK_VIOLATION);
    const row = must(await contact({ industry: "Other", industry_other: "Bakery" }));
    const { error } = await loose(serviceClient()).from("contact_requests").update({ industry: "HVAC" }).eq("id", row.id);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("#23 fix list visibility", () => {
  let selfServe: TestUser;
  let dfy: TestUser;
  let fs: Fixture;
  let fd: Fixture;

  beforeAll(async () => {
    selfServe = await newUser("self-serve");
    dfy = await newUser("dfy");
    fs = await makeWorkspace(selfServe);
    fd = await makeWorkspace(dfy);
    must(await serviceClient().from("businesses").update({ service: "dfy" }).eq("id", fd.businessId));
  });

  it("new businesses are self_serve with the fix list flag off", async () => {
    const [biz] = must(await selfServe.db.from("businesses").select("service, fix_list_visible").eq("id", fs.businessId));
    expect(biz).toEqual({ service: "self_serve", fix_list_visible: false });
  });

  it("a self-serve member sees their fixes", async () => {
    expect(must(await selfServe.db.from("fixes").select("id").eq("business_id", fs.businessId))).toEqual([{ id: fs.fixId }]);
  });

  it("a dfy member sees no fixes until the service role sets fix_list_visible", async () => {
    expect(must(await dfy.db.from("fixes").select("id").eq("business_id", fd.businessId))).toEqual([]);
    must(await serviceClient().from("businesses").update({ fix_list_visible: true }).eq("id", fd.businessId));
    expect(must(await dfy.db.from("fixes").select("id").eq("business_id", fd.businessId))).toEqual([{ id: fd.fixId }]);
    must(await serviceClient().from("businesses").update({ fix_list_visible: false }).eq("id", fd.businessId));
    expect(must(await dfy.db.from("fixes").select("id").eq("business_id", fd.businessId))).toEqual([]);
  });

  it("the service role always sees fixes", async () => {
    const rows = must(await serviceClient().from("fixes").select("id").in("business_id", [fs.businessId, fd.businessId]));
    expect(rows.map((r) => r.id).sort()).toEqual([fs.fixId, fd.fixId].sort());
  });

  it("an owner cannot update service or fix_list_visible", async () => {
    for (const [field, value] of [["service", "dfy"], ["fix_list_visible", true]] as const) {
      const { error } = await loose(dfy.db).from("businesses").update({ [field]: value }).eq("id", fd.businessId);
      expect(error?.code).toBe(RLS_DENIED);
    }
    const { error } = await loose(selfServe.db).from("businesses").update({ service: "dfy" }).eq("id", fs.businessId);
    expect(error?.code).toBe(RLS_DENIED);
    const [biz] = must(await serviceClient().from("businesses").select("service, fix_list_visible").eq("id", fd.businessId));
    expect(biz).toEqual({ service: "dfy", fix_list_visible: false });
  });

  it("an owner cannot set service or fix_list_visible on insert, but can still edit other fields", async () => {
    must(await serviceClient().from("workspaces").update({ seats_quantity: 2 }).eq("id", fs.workspaceId));
    for (const extra of [{ service: "dfy" }, { fix_list_visible: true }]) {
      const { error } = await loose(selfServe.db).from("businesses").insert({ workspace_id: fs.workspaceId, name: "Example Two", ...extra });
      expect(error?.code).toBe(RLS_DENIED);
    }
    must(await selfServe.db.from("businesses").update({ name: "Example Renamed" }).eq("id", fs.businessId));
    must(await selfServe.db.from("businesses").insert({ workspace_id: fs.workspaceId, name: "Example Two" }));
  });
});

