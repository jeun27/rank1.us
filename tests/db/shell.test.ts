import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ENGINE_IDS } from "@/lib/engines/types";
import { computeMetrics, type MetricCitation } from "@/lib/metrics/compute";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { getRunResults } from "@/lib/queries/results";
import { claimJobs, createRun, finishJob } from "@/lib/queries/run-jobs";
import {
  addCompetitor,
  dismissSuggestion,
  getCurrentBusiness,
  getQuestionsWithLatestAnswers,
  getTopFixes,
  listCompetitors,
  listRunSummaries,
} from "@/lib/queries/shell";
import type { ClaimedJob, FinishAnswer } from "@/lib/runs/types";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;

async function selfServe(tag: string, questions = 2) {
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
    competitors: [{ name: "Example Noodle Bar", domain: "example-noodle.test", source: "maps" }],
    questions: Array.from({ length: questions }, (_, i) => ({
      short_text: `best ramen in Irvine ${i}`,
      long_text: `Where is the best ramen in Irvine, take ${i}?`,
      active_form: i === 0 ? ("long" as const) : ("short" as const),
      active: true,
      location_level: "city" as const,
      country: "US",
      state: "CA",
      city: "Irvine",
      template_key: String(i),
    })),
  });
  must(await serviceClient().from("workspaces").update({ subscription_status: "active" }).eq("id", workspaceId));
  return { user, workspaceId, businessId };
}

async function drain() {
  const all: ClaimedJob[] = [];
  for (;;) {
    const batch = await claimJobs(serviceClient(), 500);
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

const answer = (status: FinishAnswer["status"], mentioned: boolean | null, competitor = false): FinishAnswer => ({
  status,
  text: status === "ok" ? "Example Ramen House and Example Noodle Bar." : null,
  location_used: "Irvine,California,United States",
  location_supported: "exact",
  mentioned: status === "ok" ? mentioned : null,
  first_position: mentioned ? 1 : null,
  brands:
    status === "ok"
      ? [
          { name: "Example Ramen House", kind: "business", mentioned: !!mentioned, position: mentioned ? 1 : null },
          { name: "Example Noodle Bar", kind: "competitor", mentioned: competitor, position: competitor ? 2 : null },
        ]
      : null,
  cost_usd: 0.01,
  raw: { secret: "vendor" },
  checked_at: new Date().toISOString(),
});

// Runs one audit to the end with a fixed mix per job index, and returns the run id.
async function finishedRun(user: TestUser, businessId: string, pick: (job: ClaimedJob, i: number) => FinishAnswer) {
  await drain();
  const runId = await createRun(serviceClient(), businessId, "audit");
  const jobs = (await drain()).filter((j) => j.run_id === runId);
  for (const [i, job] of jobs.entries()) {
    await finishJob(
      serviceClient(),
      job.job_id,
      pick(job, i),
      i === 0
        ? [
            {
              url: "https://www.yelp.com/biz/example",
              domain: "yelp.com",
              title: "Example",
              position: 2,
              category: "review_directory",
            },
            {
              url: "https://example-guide.test/a",
              domain: "example-guide.test",
              title: null,
              position: 1,
              category: "news_blog",
            },
          ]
        : [],
    );
  }
  return runId;
}

const mix = (job: ClaimedJob, i: number) =>
  i % 7 === 0
    ? answer("failed", null)
    : i % 5 === 0
      ? answer("no_overview", null)
      : answer("ok", i % 3 === 0, i % 2 === 0);

describe("listRunSummaries", () => {
  it("matches computeMetrics on the same run, overall and per engine, with a deleted question", async () => {
    const { user, businessId } = await selfServe("summary-parity", 3);
    const runId = await finishedRun(user, businessId, mix);
    const [deleted] = must(await serviceClient().from("questions").select("id").eq("business_id", businessId).limit(1));
    must(await serviceClient().from("questions").delete().eq("id", deleted.id));

    const results = (await getRunResults(user.db, runId))!;
    const expected = computeMetrics({
      answers: results.answers,
      citations: results.citations as MetricCitation[],
      brands: results.brands,
    });
    const [summary] = await listRunSummaries(user.db, businessId, 1);
    expect(summary.id).toBe(runId);
    const { byEngine, ...overall } = expected.visibility;
    expect(summary.visibility).toEqual(overall);
    for (const e of ENGINE_IDS) expect(summary.perEngine[e], e).toEqual(byEngine[e]);
    expect(summary.visibility.denominator).toBeGreaterThan(0);
    expect(summary.visibility.numerator).toBeGreaterThan(0);
    expect(summary.visibility.denominator).toBeLessThan(results.answers.length);
  });

  it("lists audit/weekly runs newest first, all statuses, limited, and never free audits", async () => {
    const { user, businessId } = await selfServe("summary-list", 1);
    const s = serviceClient();
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
    const ids: string[] = [];
    for (const [h, status] of [
      [72, "complete"],
      [48, "failed"],
      [24, "partial"],
    ] as const) {
      const id = await createRun(s, businessId, "weekly");
      must(
        await s
          .from("runs")
          .update({ status, started_at: hoursAgo(h) })
          .eq("id", id),
      );
      ids.push(id);
    }
    must(
      await s
        .from("runs")
        .insert({ kind: "free_audit", business_id: businessId, status: "complete", started_at: hoursAgo(1) }),
    );

    const all = await listRunSummaries(user.db, businessId);
    expect(all.map((r) => r.id)).toEqual([...ids].reverse());
    expect(all.map((r) => r.status)).toEqual(["partial", "failed", "complete"]);
    expect(all[0].visibility).toEqual({ value: null, numerator: 0, denominator: 0 });
    expect(Object.keys(all[0].perEngine).sort()).toEqual([...ENGINE_IDS].sort());
    expect((await listRunSummaries(user.db, businessId, 2)).map((r) => r.id)).toEqual([ids[2], ids[1]]);
    expect((await listRunSummaries(user.db, businessId, 2, ["complete", "partial"])).map((r) => r.id)).toEqual([
      ids[2],
      ids[0],
    ]);
    expect((await listRunSummaries(user.db, businessId, 8, ["failed"])).map((r) => r.id)).toEqual([ids[1]]);
  });

  it("a non-member and anon get nothing", async () => {
    const { user, businessId } = await selfServe("summary-private", 1);
    await finishedRun(user, businessId, () => answer("ok", true));
    const stranger = await newUser("summary-stranger");
    expect(await listRunSummaries(stranger.db, businessId)).toEqual([]);
    await expect(listRunSummaries(anonClient(), businessId)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("getCurrentBusiness", () => {
  it("returns the oldest active self-serve business; null for no business, strangers and dfy clients", async () => {
    const { user, workspaceId, businessId } = await selfServe("current", 1);
    const s = serviceClient();
    must(await s.from("workspaces").update({ seats_quantity: 3 }).eq("id", workspaceId));
    must(
      await s.from("businesses").insert({
        workspace_id: workspaceId,
        name: "Example Later",
        created_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    );
    expect(await getCurrentBusiness(user.db)).toEqual({
      id: businessId,
      name: "Example Ramen House",
      domain: "example-ramen.test",
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      country: "US",
      paid: true,
    });
    for (const [status, paid] of [
      ["trialing", true],
      ["past_due", false],
      ["canceled", false],
      [null, false],
      ["active", true],
    ] as const) {
      must(await s.from("workspaces").update({ subscription_status: status }).eq("id", workspaceId));
      expect((await getCurrentBusiness(user.db))?.paid, String(status)).toBe(paid);
    }
    expect(JSON.stringify(await getCurrentBusiness(user.db))).not.toContain("subscription");
    must(await s.from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", businessId));
    expect((await getCurrentBusiness(user.db))?.name).toBe("Example Later");

    const fresh = await newUser("current-none");
    await ensureSelfServeWorkspace(fresh.db);
    expect(await getCurrentBusiness(fresh.db)).toBeNull();
    expect(await getCurrentBusiness(anonClient())).toBeNull();

    const team = await newUser("current-team");
    must(await s.from("user_roles").insert({ user_id: team.id, role: "team" }));
    const client = await newUser("current-dfy");
    must(await s.from("user_roles").insert({ user_id: client.id, role: "dfy_client" }));
    const dfy = await createDfyClient(team.db, {
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
      await s.from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
    );
    expect(await getCurrentBusiness(client.db)).toBeNull();
  });
});

describe("getTopFixes", () => {
  it("returns open fixes ranked by size then rule key, never tidy-ups or why_note, at most the limit", async () => {
    const { user, businessId } = await selfServe("fixes-top", 1);
    const s = serviceClient();
    const rule = (key: string, grp = "restaurant") => ({
      key,
      grp,
      title: `Rule ${key}`,
      size: "S",
      cadence: "weekly",
      customer_copy: "Copy",
      why_note: "engineer-only secret",
      ai_lever: key !== "H1",
    });
    must(
      await s
        .from("fix_rules")
        .upsert([rule("R1"), rule("R10"), rule("R11"), rule("R12"), rule("R14"), rule("H1", "hygiene")], {
          onConflict: "key",
          ignoreDuplicates: true,
        }),
    );
    const fix = (rule_key: string, size: string, status = "todo") => ({
      business_id: businessId,
      rule_key,
      size,
      title: `Fix ${rule_key}`,
      status,
    });
    must(
      await s
        .from("fixes")
        .insert([
          fix("R11", "L"),
          fix("R10", "M-L", "doing"),
          fix("R14", "S"),
          fix("H1", "S"),
          fix("R1", "S-M"),
          fix("R12", "S", "done"),
        ]),
    );

    const top = await getTopFixes(user.db, businessId, 3);
    expect(top.map((f) => [f.rule_key, f.size, f.status])).toEqual([
      ["R14", "S", "todo"],
      ["R1", "S-M", "todo"],
      ["R10", "M-L", "doing"],
    ]);
    expect(top[0].affected_answers).toBeNull();
    expect(JSON.stringify(top)).not.toContain("engineer-only secret");
    expect(Object.keys(top[0]).sort()).toEqual([
      "affected_answers",
      "detail",
      "id",
      "rule_key",
      "size",
      "status",
      "title",
    ]);
    expect((await getTopFixes(user.db, businessId, 10)).map((f) => f.rule_key)).toEqual(["R14", "R1", "R10", "R11"]);

    const stranger = await newUser("fixes-stranger");
    expect(await getTopFixes(stranger.db, businessId)).toEqual([]);
  });
});

describe("getQuestionsWithLatestAnswers", () => {
  it("returns each question in its active form with the latest run's answers and citations, no raw or cost", async () => {
    const { user, businessId } = await selfServe("questions-latest", 2);
    const empty = await getQuestionsWithLatestAnswers(user.db, businessId);
    expect(empty.run).toBeNull();
    expect(empty.questions).toHaveLength(2);
    expect(empty.questions.every((q) => q.answers.length === 0)).toBe(true);

    await finishedRun(user, businessId, () => answer("ok", false));
    const runId = await finishedRun(user, businessId, (_j, i) =>
      i === 1 ? answer("failed", null) : answer("ok", true),
    );
    const { run, questions } = await getQuestionsWithLatestAnswers(user.db, businessId);
    expect(run?.id).toBe(runId);
    expect(questions.map((q) => q.text).sort()).toEqual(
      ["Where is the best ramen in Irvine, take 0?", "best ramen in Irvine 1"].sort(),
    );
    expect(questions.every((q) => q.answers.length === 10)).toBe(true);
    const all = questions.flatMap((q) => q.answers);
    expect(all.filter((a) => a.status === "failed")).toHaveLength(1);
    expect(all.filter((a) => a.status === "ok").every((a) => a.mentioned === true)).toBe(true);
    expect(Object.keys(all[0]).sort()).toEqual(
      [
        "checked_at",
        "citations",
        "engine",
        "location_supported",
        "location_used",
        "mentioned",
        "run_index",
        "status",
        "text",
      ].sort(),
    );
    expect(JSON.stringify(questions)).not.toContain("vendor");
    const cited = all.find((a) => a.citations.length > 0)!;
    expect(cited.citations).toEqual([
      {
        url: "https://example-guide.test/a",
        domain: "example-guide.test",
        title: null,
        position: 1,
        category: "news_blog",
      },
      {
        url: "https://www.yelp.com/biz/example",
        domain: "yelp.com",
        title: "Example",
        position: 2,
        category: "review_directory",
      },
    ]);

    const stranger = await newUser("questions-stranger");
    expect(await getQuestionsWithLatestAnswers(stranger.db, businessId)).toEqual({ run: null, questions: [] });
  });
});

describe("competitors", () => {
  it("adds, dismisses idempotently and un-hides on re-add; listCompetitors splits tracked and dismissed", async () => {
    const { user, businessId } = await selfServe("competitors-flow", 1);
    const manual = await addCompetitor(user.db, businessId, { name: "Example Izakaya", source: "manual" });
    const maps = await addCompetitor(user.db, businessId, {
      name: "Example Udon House",
      domain: "Example-Udon.test",
      rating: 4.5,
      maps_cid: "9",
      source: "maps",
    });
    expect(
      await addCompetitor(user.db, businessId, {
        name: "Example Udon (dupe name)",
        domain: "example-udon.test",
        source: "maps",
      }),
    ).toBe(maps);

    const dismissed = await dismissSuggestion(user.db, businessId, {
      name: "Example Burger Hut",
      domain: "example-burger.test",
    });
    expect(
      await dismissSuggestion(user.db, businessId, { name: "Example Burger Hut", domain: "example-burger.test" }),
    ).toBe(dismissed);
    expect(await dismissSuggestion(user.db, businessId, { name: "example burger hut" })).toBe(dismissed);

    let list = await listCompetitors(user.db, businessId);
    expect(list.tracked.map((c) => c.name)).toEqual(["Example Izakaya", "Example Noodle Bar", "Example Udon House"]);
    expect(list.tracked.find((c) => c.id === maps)).toEqual({
      id: maps,
      name: "Example Udon House",
      domain: "example-udon.test",
      source: "maps",
      rating: 4.5,
    });
    expect(list.dismissed).toEqual([
      { id: dismissed, name: "Example Burger Hut", domain: "example-burger.test", source: "suggested", rating: null },
    ]);

    expect(
      await addCompetitor(user.db, businessId, {
        name: "Example Burger Hut",
        domain: "example-burger.test",
        source: "maps",
      }),
    ).toBe(dismissed);
    await dismissSuggestion(user.db, businessId, { name: "Example Izakaya" });
    list = await listCompetitors(user.db, businessId);
    expect(list.tracked.find((c) => c.id === dismissed)?.source).toBe("maps");
    expect(list.dismissed.map((c) => c.id)).toEqual([manual]);
    expect(must(await serviceClient().from("competitors").select("id").eq("business_id", businessId))).toHaveLength(4);
  });

  it("hidden competitors drop out of the next run's tracked brands", async () => {
    const { user, businessId } = await selfServe("competitors-hidden", 1);
    await dismissSuggestion(user.db, businessId, { name: "Example Noodle Bar", domain: "example-noodle.test" });
    await drain();
    await createRun(serviceClient(), businessId, "audit");
    const [job] = (await drain()).filter((j) => j.business.id === businessId);
    expect(job.competitors).toEqual([]);
  });

  it("rejects a bad name, domain, rating or source (22023)", async () => {
    const { user, businessId } = await selfServe("competitors-bad", 1);
    const bad = [
      { name: " ", source: "manual" },
      { name: "x".repeat(201), source: "manual" },
      { name: "Example", domain: "not a domain", source: "manual" },
      { name: "Example", rating: 6, source: "maps" },
      { name: "Example", source: "suggested" },
    ];
    for (const p of bad) {
      const { error } = await loose(user.db).rpc("add_competitor", { p_business_id: businessId, p });
      expect(error?.code, JSON.stringify(p)).toBe("22023");
    }
    await expect(dismissSuggestion(user.db, businessId, { name: "" })).rejects.toMatchObject({ code: "22023" });
  });

  it("a non-member, anon and a dfy_client cannot change competitors (42501)", async () => {
    const { businessId } = await selfServe("competitors-owner", 1);
    const stranger = await newUser("competitors-stranger");
    await expect(addCompetitor(stranger.db, businessId, { name: "Example", source: "manual" })).rejects.toMatchObject({
      code: "42501",
    });
    await expect(dismissSuggestion(stranger.db, businessId, { name: "Example" })).rejects.toMatchObject({
      code: "42501",
    });
    await expect(addCompetitor(anonClient(), businessId, { name: "Example", source: "manual" })).rejects.toMatchObject({
      code: "42501",
    });
    expect(await listCompetitors(stranger.db, businessId)).toEqual({ tracked: [], dismissed: [] });

    const s = serviceClient();
    const team = await newUser("competitors-team");
    must(await s.from("user_roles").insert({ user_id: team.id, role: "team" }));
    const client = await newUser("competitors-dfy");
    must(await s.from("user_roles").insert({ user_id: client.id, role: "dfy_client" }));
    const dfy = await createDfyClient(team.db, {
      workspace_name: "Example DFY Competitors",
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
      await s.from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
    );

    await expect(addCompetitor(client.db, dfy.businessId, { name: "Example", source: "manual" })).rejects.toMatchObject(
      { code: "42501" },
    );
    await expect(dismissSuggestion(client.db, dfy.businessId, { name: "Example" })).rejects.toMatchObject({
      code: "42501",
    });
    const direct = await client.db
      .from("competitors")
      .insert({ business_id: dfy.businessId, name: "Example", source: "manual" });
    expect(direct.error?.code).toBe("42501");
    expect(await listCompetitors(client.db, dfy.businessId)).toEqual({ tracked: [], dismissed: [] });

    const teamAdd = await addCompetitor(team.db, dfy.businessId, { name: "Example Team Pick", source: "manual" });
    expect((await listCompetitors(client.db, dfy.businessId)).tracked.map((c) => c.id)).toEqual([teamAdd]);
  });
});
