import { beforeAll, describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { listDoneFixes, listFixes, recordFixResults, setFixStatus, type FixCheckResult } from "@/lib/queries/fixes";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { must, newUser, serviceClient, type TestUser } from "./helpers";

// 0023 fix status history: status_changed_at/by are set by a trigger on every status change and
// kept on any other update. done_fixes shows the actor as {is_team, name}, never the email.
const s = () => serviceClient();

beforeAll(async () => {
  const rule = (key: string) => ({
    key,
    grp: "restaurant",
    title: `Rule ${key}`,
    size: "S",
    cadence: "weekly",
    customer_copy: "Copy",
    why_note: "engineer-only note",
    ai_lever: true,
    enabled: true,
  });
  must(
    await s()
      .from("fix_rules")
      .upsert([rule("R10"), rule("R14")], { onConflict: "key", ignoreDuplicates: true }),
  );
});

const named = async (tag: string, fullName: string) => {
  const user = await newUser(tag);
  const { error } = await s().auth.admin.updateUserById(user.id, { user_metadata: { full_name: fullName } });
  if (error) throw error;
  return user;
};

const business = {
  name: "Example Ramen House",
  domain: "example-ramen.test",
  cuisine: "ramen",
  city: "Irvine",
  state: "CA",
  country: "US",
  aliases: [],
};

async function closedRun(businessId: string) {
  const run = must(
    await s()
      .from("runs")
      .insert({ business_id: businessId, kind: "weekly", status: "complete", started_at: new Date().toISOString() })
      .select("id")
      .single(),
  );
  return run.id as string;
}

const fix = (rule_key: string): FixCheckResult => ({ rule_key, result: "fix", evidence: null, detail: "Detail" });
const ok = (rule_key: string): FixCheckResult => ({ rule_key, result: "ok", evidence: null, detail: null });

const history = async (id: string) =>
  must(await s().from("fixes").select("status, status_changed_at, status_changed_by").eq("id", id).single());

let owner: TestUser;
let ownerBusiness: string;
let team: TestUser;
let client: TestUser;
let outsider: TestUser;
let dfyBusiness: string;

beforeAll(async () => {
  owner = await named("hist-owner", "Example Owner");
  await ensureSelfServeWorkspace(owner.db);
  ownerBusiness = await createBusinessOnboarding(owner.db, { business, competitors: [], questions: [] });
  team = await named("hist-team", "Example Team Person");
  client = await named("hist-client", "Example Client");
  outsider = await newUser("hist-outsider");
  must(
    await s()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
  const dfy = await createDfyClient(team.db, {
    workspace_name: "Example DFY History",
    business: { ...business, name: "Example Pho Spot" },
  });
  dfyBusiness = dfy.businessId;
  must(
    await s().from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
  );
  must(await s().from("businesses").update({ fix_list_visible: true }).eq("id", dfyBusiness));
});

const fixId = async (businessId: string, rule: string) =>
  must(
    await s()
      .from("fixes")
      .select("id")
      .eq("business_id", businessId)
      .eq("rule_key", rule)
      .neq("status", "done")
      .single(),
  ).id;

describe("status history", () => {
  it("existing rows have no history; every transition sets the time and the actor", async () => {
    await recordFixResults(s(), ownerBusiness, await closedRun(ownerBusiness), [fix("R10")]);
    const id = await fixId(ownerBusiness, "R10");
    expect(await history(id)).toEqual({ status: "todo", status_changed_at: null, status_changed_by: null });

    let last = 0;
    for (const status of ["doing", "done", "todo", "done"] as const) {
      await setFixStatus(owner.db, id, status);
      const h = await history(id);
      expect(h).toMatchObject({ status, status_changed_by: owner.id });
      const at = Date.parse(h.status_changed_at!);
      expect(at).toBeGreaterThanOrEqual(last);
      last = at;
    }
  });

  it("other updates keep the history, and it can't be spoofed through a direct update", async () => {
    await recordFixResults(s(), ownerBusiness, await closedRun(ownerBusiness), [fix("R14")]);
    const id = await fixId(ownerBusiness, "R14");
    await setFixStatus(owner.db, id, "doing");
    const before = await history(id);
    must(await s().from("fixes").update({ title: "Renamed" }).eq("id", id));
    must(
      await owner.db
        .from("fixes")
        .update({ status_changed_by: team.id, status_changed_at: "2020-01-01T00:00:00Z" })
        .eq("id", id),
    );
    expect(await history(id)).toEqual(before);
    must(await owner.db.from("fixes").update({ status: "todo", status_changed_by: team.id }).eq("id", id));
    expect(await history(id)).toMatchObject({ status: "todo", status_changed_by: owner.id });
  });

  it("an insert with spoofed history values gets none, for a member and for the service role", async () => {
    const spoof = { status_changed_by: team.id, status_changed_at: "2020-01-01T00:00:00Z" };
    const row = (db: TestUser["db"], rule_key: string, status: string) =>
      db
        .from("fixes")
        .insert({ business_id: ownerBusiness, rule_key, size: "S", title: "Example", status, ...spoof })
        .select("id, status_changed_at, status_changed_by")
        .single();
    for (const [db, rule, status] of [
      [owner.db, "R10", "done"],
      [s(), "R14", "done"],
    ] as const) {
      const inserted = must(await row(db, rule, status));
      expect(inserted).toMatchObject({ status_changed_at: null, status_changed_by: null });
      must(await s().from("fixes").delete().eq("id", inserted.id));
    }
  });

  it("the detector's auto-close records the time with no actor", async () => {
    const x = await named("hist-auto", "Example Auto");
    await ensureSelfServeWorkspace(x.db);
    const b = await createBusinessOnboarding(x.db, { business, competitors: [], questions: [] });
    await recordFixResults(s(), b, await closedRun(b), [fix("R10")]);
    const id = await fixId(b, "R10");
    await recordFixResults(s(), b, await closedRun(b), [ok("R10")]);
    const h = await history(id);
    expect(h.status).toBe("done");
    expect(h.status_changed_at).not.toBeNull();
    expect(h.status_changed_by).toBeNull();
    expect((await listDoneFixes(x.db, b)).find((f) => f.id === id)?.changed_by).toBeNull();
  });

  it("a dfy_client still can't change a status (42501)", async () => {
    await recordFixResults(s(), dfyBusiness, await closedRun(dfyBusiness), [fix("R10")]);
    const id = await fixId(dfyBusiness, "R10");
    await expect(setFixStatus(client.db, id, "done")).rejects.toMatchObject({ code: "42501" });
    expect(await history(id)).toMatchObject({ status: "todo", status_changed_by: null });
  });
});

describe("done_fixes", () => {
  it("lists done fixes newest change first, with a member's name and never an email", async () => {
    const done = await listDoneFixes(owner.db, ownerBusiness);
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((f) => f.status_changed_at !== null)).toBe(true);
    const times = done.map((f) => Date.parse(f.status_changed_at!));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(done[0]).toMatchObject({ rule_key: "R10", title: expect.any(String) });
    expect(done[0].changed_by).toEqual({ is_team: false, name: "Example Owner" });
    expect(JSON.stringify(done)).not.toContain("@");
  });

  it("team actors show as is_team only, to the dfy_client and to the team", async () => {
    const id = await fixId(dfyBusiness, "R10");
    await setFixStatus(team.db, id, "done");
    for (const db of [client.db, team.db]) {
      const row = (await listDoneFixes(db, dfyBusiness)).find((f) => f.id === id);
      expect(row?.changed_by).toEqual({ is_team: true, name: null });
      expect(JSON.stringify(row)).not.toContain("Example Team Person");
    }
  });

  it("follows the fix list visibility: nothing for an outsider or a hidden DFY list", async () => {
    expect(await listDoneFixes(outsider.db, ownerBusiness)).toEqual([]);
    must(await s().from("businesses").update({ fix_list_visible: false }).eq("id", dfyBusiness));
    expect(await listDoneFixes(client.db, dfyBusiness)).toEqual([]);
    expect((await listDoneFixes(team.db, dfyBusiness)).length).toBeGreaterThan(0);
    must(await s().from("businesses").update({ fix_list_visible: true }).eq("id", dfyBusiness));
  });
});

describe("who/when on open fixes (listFixes)", () => {
  const item = async (db: TestUser["db"], businessId: string, id: string) => {
    const list = await listFixes(db, businessId);
    return [...list.ranked, ...list.tidyUps].find((f) => f.id === id);
  };

  it("a doing row shows the member's name and the time; a todo row shows neither, even after a reopen", async () => {
    const doing = await fixId(ownerBusiness, "R14");
    expect((await history(doing)).status_changed_by).toBe(owner.id); // reopened to todo earlier
    expect(await item(owner.db, ownerBusiness, doing)).toMatchObject({
      status: "todo",
      status_changed_at: null,
      changed_by: null,
    });
    await setFixStatus(owner.db, doing, "doing");
    const row = await item(owner.db, ownerBusiness, doing);
    expect(row).toMatchObject({ status: "doing", changed_by: { is_team: false, name: "Example Owner" } });
    expect(row?.status_changed_at).toBe((await history(doing)).status_changed_at);
    expect(JSON.stringify(row)).not.toContain("@");
  });

  it("a doing row moved by the team shows is_team only, to the team and to the dfy_client", async () => {
    await recordFixResults(s(), dfyBusiness, await closedRun(dfyBusiness), [fix("R14")]);
    const id = await fixId(dfyBusiness, "R14");
    await setFixStatus(team.db, id, "doing");
    for (const db of [team.db, client.db]) {
      const row = await item(db, dfyBusiness, id);
      expect(row).toMatchObject({ status: "doing", changed_by: { is_team: true, name: null } });
      expect(row?.status_changed_at).not.toBeNull();
      expect(JSON.stringify(row)).not.toContain("Example Team Person");
    }
  });
});
