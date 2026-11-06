import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import {
  listFixes,
  listRunsNeedingFixChecks,
  recordFixResults,
  setFixStatus,
  type FixCheckResult,
} from "@/lib/queries/fixes";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;
const SITE_RULES = ["R10", "R11", "R14", "H1"];

// The enabled site rules (seeded; re-created here when the rollback test dropped the seed).
beforeAll(async () => {
  const rule = (key: string, size: string) => ({
    key,
    grp: key === "H1" ? "hygiene" : "restaurant",
    title: `Rule ${key}`,
    size,
    cadence: "weekly",
    customer_copy: "Copy",
    why_note: "engineer-only note",
    ai_lever: key !== "H1",
    enabled: true,
  });
  must(
    await serviceClient()
      .from("fix_rules")
      .upsert([rule("R10", "M-L"), rule("R11", "L"), rule("R14", "S"), rule("H1", "S")], {
        onConflict: "key",
        ignoreDuplicates: true,
      }),
  );
  must(
    await serviceClient().from("fix_rules").upsert(
      {
        key: "R1",
        grp: "restaurant",
        title: "Rule R1",
        size: "S",
        cadence: "weekly",
        customer_copy: "Copy",
        enabled: false,
      },
      { onConflict: "key", ignoreDuplicates: true },
    ),
  );
});

async function selfServe(tag: string) {
  const user = await newUser(tag);
  const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
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
  return { user, workspaceId, businessId };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

// A closed paid run (no jobs needed for fix checks).
async function closedRun(businessId: string, h = 1, kind = "weekly", status = "complete") {
  const run = must(
    await serviceClient()
      .from("runs")
      .insert({ business_id: businessId, kind, status, started_at: hoursAgo(h + 1), finished_at: hoursAgo(h) })
      .select("id")
      .single(),
  );
  return run.id as string;
}

const fix = (rule_key: string, detail = `Detail for ${rule_key}`): FixCheckResult => ({
  rule_key,
  result: "fix",
  evidence: { example: rule_key },
  detail,
});
const ok = (rule_key: string): FixCheckResult => ({ rule_key, result: "ok", evidence: null, detail: null });
const unchecked = (rule_key: string): FixCheckResult => ({
  rule_key,
  result: "unchecked",
  evidence: null,
  detail: null,
});

const fixRows = async (businessId: string) =>
  must(
    await serviceClient()
      .from("fixes")
      .select("rule_key, status, title, size, detail, evidence, first_seen_run, last_seen_run, affected_answers")
      .eq("business_id", businessId)
      .order("rule_key"),
  );

describe("record_fix_results", () => {
  it("opens fixes, auto-resolves, leaves unchecked rules alone, and is a no-op on a recorded run", async () => {
    const { user, businessId } = await selfServe("record-flow");
    const s = serviceClient();
    const run1 = await closedRun(businessId, 72);
    await recordFixResults(s, businessId, run1, [fix("R10"), fix("R11"), unchecked("R14"), fix("H1")]);

    const [rule10] = must(await s.from("fix_rules").select("title, size").eq("key", "R10"));
    let rows = await fixRows(businessId);
    expect(rows.map((r) => [r.rule_key, r.status])).toEqual([
      ["H1", "todo"],
      ["R10", "todo"],
      ["R11", "todo"],
    ]);
    expect(rows.find((r) => r.rule_key === "R10")).toMatchObject({
      title: rule10.title,
      size: rule10.size,
      detail: "Detail for R10",
      evidence: { example: "R10" },
      first_seen_run: run1,
      last_seen_run: run1,
      affected_answers: null,
    });

    let list = await listFixes(user.db, businessId);
    expect(list.ranked.map((f) => f.rule_key)).toEqual(["R10", "R11"]);
    expect(list.tidyUps.map((f) => f.rule_key)).toEqual(["H1"]);
    const [rule14] = must(await s.from("fix_rules_public").select("title").eq("key", "R14"));
    expect(list.unchecked).toEqual([{ rule_key: "R14", title: rule14.title }]);
    expect(Object.keys(list.ranked[0]).sort()).toEqual([
      "affected_answers",
      "detail",
      "id",
      "pillar",
      "rule_key",
      "status",
      "title",
    ]);
    expect(list.lastRunId).toBe(run1);

    // A repeat for the same run changes nothing.
    await recordFixResults(s, businessId, run1, [ok("R10"), ok("R11"), ok("R14"), ok("H1")]);
    expect((await fixRows(businessId)).map((r) => r.status)).toEqual(["todo", "todo", "todo"]);

    // Run 2: R10 still found (keeps its status and first_seen), R11 ok (auto-resolved), H1 unchecked (kept).
    await setFixStatus(user.db, list.ranked.find((f) => f.rule_key === "R10")!.id, "doing");
    const run2 = await closedRun(businessId, 24);
    await recordFixResults(s, businessId, run2, [fix("R10", "New detail"), ok("R11"), ok("R14"), unchecked("H1")]);
    rows = await fixRows(businessId);
    expect(rows.map((r) => [r.rule_key, r.status])).toEqual([
      ["H1", "todo"],
      ["R10", "doing"],
      ["R11", "done"],
    ]);
    expect(rows.find((r) => r.rule_key === "R10")).toMatchObject({
      detail: "New detail",
      first_seen_run: run1,
      last_seen_run: run2,
    });
    expect(rows.find((r) => r.rule_key === "H1")?.last_seen_run).toBe(run1);

    list = await listFixes(user.db, businessId);
    expect(list.ranked.map((f) => f.rule_key)).toEqual(["R10"]);
    expect(list.unchecked.map((u) => u.rule_key)).toEqual(["H1"]);
    expect(list.lastRunId).toBe(run2);
  });

  it("a fix marked done that is detected again comes back as a fresh todo", async () => {
    const { user, businessId } = await selfServe("record-reopen");
    const s = serviceClient();
    await recordFixResults(s, businessId, await closedRun(businessId, 48), [fix("R14")]);
    const [first] = (await listFixes(user.db, businessId)).ranked;
    await setFixStatus(user.db, first.id, "done");
    expect((await listFixes(user.db, businessId)).ranked).toEqual([]);

    const run = await closedRun(businessId, 2);
    await recordFixResults(s, businessId, run, [fix("R14")]);
    const [again] = (await listFixes(user.db, businessId)).ranked;
    expect(again.id).not.toBe(first.id);
    expect(again).toMatchObject({ rule_key: "R14", status: "todo" });
    const reopened = (await fixRows(businessId)).find((r) => r.status === "todo");
    expect(reopened?.first_seen_run).toBe(run);
    expect((await fixRows(businessId)).map((r) => r.status).sort()).toEqual(["done", "todo"]);
  });

  it("rejects bad runs and results with 22023, storing nothing", async () => {
    const { businessId } = await selfServe("record-bad");
    const other = await selfServe("record-other");
    const s = serviceClient();
    const run = await closedRun(businessId);
    const bad: [string, string, unknown][] = [
      ["disabled rule", run, [fix("R1")]],
      ["placeholder rule", run, [fix("A1")]],
      ["unknown rule", run, [fix("Z9")]],
      ["bad result", run, [{ rule_key: "R10", result: "maybe", evidence: null, detail: null }]],
      ["fix without detail", run, [{ ...fix("R10"), detail: " " }]],
      ["duplicate rule", run, [fix("R10"), ok("R10")]],
      ["empty", run, []],
      ["queued run", await closedRun(businessId, 1, "weekly", "queued"), [fix("R10")]],
      ["failed run", await closedRun(businessId, 1, "audit", "failed"), [fix("R10")]],
      ["another business's run", await closedRun(other.businessId), [fix("R10")]],
    ];
    for (const [label, runId, results] of bad) {
      const { error } = await loose(s).rpc("record_fix_results", {
        p_business_id: businessId,
        p_run_id: runId,
        p_results: results,
      });
      expect(error?.code, label).toBe("22023");
    }
    const free = must(await s.from("runs").insert({ kind: "free_audit", status: "complete" }).select("id").single());
    const { error } = await loose(s).rpc("record_fix_results", {
      p_business_id: businessId,
      p_run_id: free.id,
      p_results: [fix("R10")],
    });
    expect(error?.code).toBe("22023");
    expect(await fixRows(businessId)).toEqual([]);
    expect(must(await s.from("fix_checks").select("rule_key").eq("business_id", businessId))).toEqual([]);
  });

  it("refuses signed-in users and anon (42501)", async () => {
    const { user, businessId } = await selfServe("record-caller");
    const run = await closedRun(businessId);
    await expect(recordFixResults(user.db, businessId, run, [fix("R10")])).rejects.toMatchObject({ code: "42501" });
    await expect(recordFixResults(anonClient(), businessId, run, [fix("R10")])).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("runs needing fix checks", () => {
  it("lists closed paid runs until recorded (all-unchecked counts as recorded), oldest first", async () => {
    const { businessId } = await selfServe("needing");
    const s = serviceClient();
    const older = await closedRun(businessId, 500);
    const newer = await closedRun(businessId, 400, "audit", "partial");
    const queued = await closedRun(businessId, 1, "weekly", "queued");
    const failed = await closedRun(businessId, 1, "weekly", "failed");
    const ids = async () => (await listRunsNeedingFixChecks(s, 1000)).map((r) => r.runId);

    let listed = await ids();
    expect(listed.indexOf(older)).toBeGreaterThanOrEqual(0);
    expect(listed.indexOf(older)).toBeLessThan(listed.indexOf(newer));
    expect(listed).not.toContain(queued);
    expect(listed).not.toContain(failed);
    expect((await listRunsNeedingFixChecks(s, 1000)).find((r) => r.runId === older)).toEqual({
      runId: older,
      businessId,
      domain: "example-ramen.test",
    });

    await recordFixResults(s, businessId, older, SITE_RULES.map(unchecked));
    listed = await ids();
    expect(listed).not.toContain(older);
    expect(listed).toContain(newer);
    expect(await listRunsNeedingFixChecks(s, 1)).toHaveLength(1);

    const user = await newUser("needing-caller");
    await expect(listRunsNeedingFixChecks(user.db)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("role gate", () => {
  let owner: { user: TestUser; businessId: string };
  let team: TestUser;
  let client: TestUser;
  let dfyBusinessId: string;

  beforeAll(async () => {
    const s = serviceClient();
    owner = await selfServe("gate-owner");
    await recordFixResults(s, owner.businessId, await closedRun(owner.businessId), [
      fix("R10"),
      unchecked("R14"),
      fix("H1"),
    ]);

    team = await newUser("gate-team");
    must(await s.from("user_roles").insert({ user_id: team.id, role: "team" }));
    client = await newUser("gate-client");
    must(await s.from("user_roles").insert({ user_id: client.id, role: "dfy_client" }));
    const dfy = await createDfyClient(team.db, {
      workspace_name: "Example DFY Fixes",
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
    dfyBusinessId = dfy.businessId;
    must(
      await s.from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
    );
    await recordFixResults(s, dfyBusinessId, await closedRun(dfyBusinessId), [fix("R10"), unchecked("R11")]);
  });

  it("self-serve members read and write their fix list", async () => {
    const list = await listFixes(owner.user.db, owner.businessId);
    expect(list.ranked.map((f) => f.rule_key)).toEqual(["R10"]);
    await setFixStatus(owner.user.db, list.ranked[0].id, "doing");
    expect((await listFixes(owner.user.db, owner.businessId)).ranked[0].status).toBe("doing");
    await expect(setFixStatus(owner.user.db, list.ranked[0].id, "maybe" as never)).rejects.toMatchObject({
      code: "22023",
    });
  });

  it("team members read and write a dfy business's fix list while it is hidden from the client", async () => {
    const list = await listFixes(team.db, dfyBusinessId);
    expect(list.ranked.map((f) => f.rule_key)).toEqual(["R10"]);
    expect(list.unchecked.map((u) => u.rule_key)).toEqual(["R11"]);
    await setFixStatus(team.db, list.ranked[0].id, "doing");
  });

  it("a dfy_client reads only when fix_list_visible is on, and never writes", async () => {
    expect(await listFixes(client.db, dfyBusinessId)).toEqual({
      ranked: [],
      tidyUps: [],
      unchecked: [],
      lastRunId: null,
    });
    const [row] = must(await serviceClient().from("fixes").select("id").eq("business_id", dfyBusinessId));
    await expect(setFixStatus(client.db, row.id, "done")).rejects.toMatchObject({ code: "42501" });

    must(await serviceClient().from("businesses").update({ fix_list_visible: true }).eq("id", dfyBusinessId));
    const visible = await listFixes(client.db, dfyBusinessId);
    expect(visible.ranked.map((f) => f.rule_key)).toEqual(["R10"]);
    expect(visible.unchecked.map((u) => u.rule_key)).toEqual(["R11"]);
    await expect(setFixStatus(client.db, row.id, "done")).rejects.toMatchObject({ code: "42501" });
    expect(must(await serviceClient().from("fixes").select("status").eq("id", row.id).single()).status).toBe("doing");
    must(await serviceClient().from("businesses").update({ fix_list_visible: false }).eq("id", dfyBusinessId));
  });

  it("a non-member gets nothing and can't write; anon is refused", async () => {
    const stranger = await newUser("gate-stranger");
    expect(await listFixes(stranger.db, owner.businessId)).toEqual({
      ranked: [],
      tidyUps: [],
      unchecked: [],
      lastRunId: null,
    });
    const [row] = must(await serviceClient().from("fixes").select("id").eq("business_id", owner.businessId).limit(1));
    await expect(setFixStatus(stranger.db, row.id, "done")).rejects.toMatchObject({ code: "42501" });
    await expect(listFixes(anonClient(), owner.businessId)).rejects.toMatchObject({ code: "42501" });
    await expect(setFixStatus(anonClient(), row.id, "done")).rejects.toMatchObject({ code: "42501" });
  });

  it("why_note is never readable by signed-in users, and never in the fix list", async () => {
    expect(must(await owner.user.db.from("fix_rules").select("*"))).toEqual([]);
    const { error } = await loose(owner.user.db).from("fix_rules_public").select("why_note");
    expect(error).not.toBeNull();
    const notes = must(await serviceClient().from("fix_rules").select("why_note").in("key", SITE_RULES));
    const json = JSON.stringify(await listFixes(owner.user.db, owner.businessId));
    for (const { why_note } of notes) if (why_note) expect(json).not.toContain(why_note);
  });

  it("members cannot write fix_checks directly", async () => {
    const { error } = await loose(owner.user.db)
      .from("fix_checks")
      .insert({ run_id: owner.businessId, business_id: owner.businessId, rule_key: "R10", result: "ok" });
    expect(error?.code).toBe("42501");
  });
});
