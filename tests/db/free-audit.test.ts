import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import {
  bumpFreeAuditNotifyAttempts,
  getFreeAuditByToken,
  getPreviousRun,
  getRunResults,
  listUnnotifiedFreeAudits,
  markFreeAuditNotified,
} from "@/lib/queries/results";
import { claimJobs, createRun, finishJob } from "@/lib/queries/run-jobs";
import type { ClaimedJob, FinishAnswer } from "@/lib/runs/types";
import { anonClient, must, newUser, serviceClient } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;

async function newLead(domain = "example-ramen.test") {
  const token = randomUUID();
  const lead = must(
    await serviceClient()
      .from("leads")
      .insert({ email: `lead-${randomUUID()}@example.test`, domain, token })
      .select()
      .single(),
  );
  return { ...lead, token };
}

const freeInput = (leadId: string, questions = 2, extra: Record<string, unknown> = {}) => ({
  lead_id: leadId,
  business: { name: "Example Ramen House", domain: "Example-Ramen.test", aliases: ["Example Ramen"] },
  competitors: [
    { name: "Example Noodle Bar", domain: "example-noodle.test" },
    { name: "Example Izakaya", domain: "" },
  ],
  location: { country: "US", state: "CA", city: "Irvine" },
  questions: Array.from({ length: questions }, (_, i) => ({
    text: `best ramen in Irvine ${i + 1}`,
    location_level: i === 0 ? "country" : "city",
  })),
  ...extra,
});

const createFree = async (db: unknown, p: unknown) => loose(db).rpc("create_free_audit", { p });

async function drain() {
  const all: ClaimedJob[] = [];
  for (;;) {
    const batch = await claimJobs(serviceClient(), 500);
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

const ok = (mentioned: boolean): FinishAnswer => ({
  status: "ok",
  text: "Example answer.",
  location_used: "United States",
  location_supported: "fallback_country",
  mentioned,
  first_position: mentioned ? 1 : null,
  brands: [{ name: "Example Ramen House", kind: "business", mentioned, position: mentioned ? 1 : null }],
  cost_usd: 0.01,
  raw: null,
  checked_at: new Date().toISOString(),
});
const failed: FinishAnswer = {
  ...ok(false),
  status: "failed",
  text: null,
  mentioned: null,
  brands: null,
  first_position: null,
};

async function paidBusiness(tag: string, questions = 1) {
  const user = await newUser(tag);
  const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
  const businessId = await createBusinessOnboarding(user.db, {
    business: {
      name: "Example Pho Spot",
      domain: "example-pho.test",
      cuisine: "pho",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
    competitors: [
      { name: "Example Udon House", domain: "example-udon.test", source: "maps" },
      { name: "Example Hidden", source: "manual" },
    ],
    questions: Array.from({ length: questions }, (_, i) => ({
      short_text: `best pho in Irvine ${i}`,
      long_text: `Where is great pho in Irvine ${i}?`,
      active_form: "short" as const,
      active: true,
      location_level: "city" as const,
      country: "US",
      state: "CA",
      city: "Irvine",
      template_key: String(i),
    })),
  });
  const s = serviceClient();
  must(await s.from("competitors").update({ hidden: true }).eq("business_id", businessId).eq("name", "Example Hidden"));
  must(await s.from("workspaces").update({ subscription_status: "active" }).eq("id", workspaceId));
  return { user, businessId };
}

describe("create_free_audit", () => {
  it("creates the run, 10 jobs per question with the question inline, the snapshot and leads.run_id", async () => {
    const lead = await newLead();
    const { data: runId, error } = await createFree(serviceClient(), freeInput(lead.id, 3));
    expect(error).toBeNull();
    const s = serviceClient();
    const run = must(await s.from("runs").select("*").eq("id", runId).single());
    expect(run).toMatchObject({ kind: "free_audit", business_id: null, status: "queued", jobs_total: 30 });
    expect(run.started_at).not.toBeNull();

    const jobs = must(await s.from("run_jobs").select("*").eq("run_id", runId));
    expect(jobs).toHaveLength(30);
    expect(jobs.every((j) => j.question_id === null && j.run_kind === "free_audit" && j.question_text)).toBe(true);
    expect(jobs.filter((j) => j.engine === "perplexity")).toHaveLength(3);
    const country = jobs.filter((j) => j.question_text === "best ramen in Irvine 1");
    expect(country.every((j) => j.location_level === "country" && j.country === "US" && !j.state && !j.city)).toBe(
      true,
    );
    const city = jobs.filter((j) => j.question_text === "best ramen in Irvine 2");
    expect(city.every((j) => j.location_level === "city" && j.state === "CA" && j.city === "Irvine")).toBe(true);

    const snapshot = must(await s.from("free_audits").select("*").eq("run_id", runId).single());
    expect(snapshot).toMatchObject({
      lead_id: lead.id,
      domain: "example-ramen.test",
      country: "US",
      state: "CA",
      city: "Irvine",
    });
    expect(snapshot).toMatchObject({ notified_at: null, notify_sent: null, notify_attempts: 0 });
    expect(snapshot.brands).toEqual({
      business: {
        id: "business",
        name: "Example Ramen House",
        aliases: ["Example Ramen"],
        domain: "example-ramen.test",
      },
      competitors: [
        { id: "competitor-1", name: "Example Noodle Bar", aliases: [], domain: "example-noodle.test" },
        { id: "competitor-2", name: "Example Izakaya", aliases: [], domain: null },
      ],
    });
    expect(must(await s.from("leads").select("run_id").eq("id", lead.id).single()).run_id).toBe(runId);
  });

  it("uses the domain as the brand name when the site name is unknown", async () => {
    const lead = await newLead("example-unread.test");
    const input = freeInput(lead.id, 1, { business: { name: null, domain: "example-unread.test" } });
    const { data: runId } = await createFree(serviceClient(), input);
    const snapshot = must(await serviceClient().from("free_audits").select("brands").eq("run_id", runId).single());
    expect((snapshot.brands as { business: unknown }).business).toEqual({
      id: "business",
      name: "example-unread.test",
      aliases: [],
      domain: "example-unread.test",
    });
  });

  it("is idempotent: a lead with a run gets the same run back", async () => {
    const lead = await newLead();
    const first = await createFree(serviceClient(), freeInput(lead.id, 2));
    const second = await createFree(serviceClient(), freeInput(lead.id, 5));
    expect(second.data).toBe(first.data);
    expect(must(await serviceClient().from("run_jobs").select("id").eq("run_id", first.data))).toHaveLength(20);
  });

  it("refuses signed-in users and anon (42501)", async () => {
    const lead = await newLead();
    const user = await newUser("free-caller");
    for (const db of [user.db, anonClient()]) {
      expect((await createFree(db, freeInput(lead.id))).error?.code).toBe("42501");
    }
    expect(must(await serviceClient().from("leads").select("run_id").eq("id", lead.id).single()).run_id).toBeNull();
  });

  it("is atomic: invalid input stores nothing (22023)", async () => {
    const bad: [string, Record<string, unknown>][] = [
      ["26 questions", { questions: Array.from({ length: 26 }, () => ({ text: "q", location_level: "city" })) }],
      ["no questions", { questions: [] }],
      ["blank question", { questions: [{ text: " ", location_level: "city" }] }],
      ["long question", { questions: [{ text: "x".repeat(501), location_level: "city" }] }],
      ["bad level", { questions: [{ text: "q", location_level: "galaxy" }] }],
      ["bad domain", { business: { name: "x", domain: "not a domain" } }],
      ["6 competitors", { competitors: Array.from({ length: 6 }, (_, i) => ({ name: `Example ${i}` })) }],
      ["bad competitor domain", { competitors: [{ name: "Example", domain: "bad domain" }] }],
      ["no country", { location: { country: "", state: "CA", city: "Irvine" } }],
    ];
    for (const [label, patch] of bad) {
      const lead = await newLead();
      const { error } = await createFree(serviceClient(), freeInput(lead.id, 1, patch));
      expect(error?.code, label).toBe("22023");
      expect(
        must(await serviceClient().from("leads").select("run_id").eq("id", lead.id).single()).run_id,
        label,
      ).toBeNull();
      expect(must(await serviceClient().from("free_audits").select("run_id").eq("lead_id", lead.id)), label).toEqual(
        [],
      );
    }
    const unknown = await createFree(serviceClient(), freeInput(randomUUID()));
    expect(unknown.error?.code).toBe("22023");
  });
});

describe("free audit privacy", () => {
  it("no free-audit row is readable by signed-in users or anon", async () => {
    const lead = await newLead();
    const { data: runId } = await createFree(serviceClient(), freeInput(lead.id, 1));
    await drain();
    const [job] = must(await serviceClient().from("run_jobs").select("id").eq("run_id", runId).limit(1));
    await finishJob(serviceClient(), job.id, ok(true), [
      {
        url: "https://www.yelp.com/biz/example",
        domain: "yelp.com",
        title: null,
        position: 1,
        category: "review_directory",
      },
    ]);

    const user = await newUser("free-snoop");
    for (const db of [user.db, anonClient()]) {
      for (const table of ["free_audits", "run_jobs"]) {
        expect((await loose(db).from(table).select("*")).error?.code, table).toBe("42501");
      }
      for (const table of ["runs", "answers"]) {
        const { data, error } = await loose(db)
          .from(table)
          .select("id")
          .eq(table === "runs" ? "id" : "run_id", runId);
        if (error) expect(error.code).toBe("42501");
        else expect(data, table).toEqual([]);
      }
      const { data, error } = await loose(db).from("citations").select("id").eq("domain", "yelp.com");
      if (error) expect(error.code).toBe("42501");
      else expect((data ?? []).length).toBe(0);
      expect(await getRunResults(db as typeof user.db, runId)).toBeNull();
    }
  });
});

describe("run_jobs kind rules", () => {
  it("a paid job still requires question_id, and a free job may not have one", async () => {
    const { user, businessId } = await paidBusiness("jobs-kind");
    const paidRun = await createRun(user.db, businessId, "audit");
    const [paidJob] = must(await serviceClient().from("run_jobs").select("question_id").eq("run_id", paidRun).limit(1));
    const lead = await newLead();
    const { data: freeRun } = await createFree(serviceClient(), freeInput(lead.id, 1));
    const s = serviceClient();
    const inline = { question_text: "q", location_level: "city", country: "US" };

    const noQuestion = await s
      .from("run_jobs")
      .insert({ run_id: paidRun, run_kind: "audit", engine: "chatgpt", run_index: 3, ...inline });
    expect(noQuestion.error?.code).toBe("23514");
    const withQuestion = await s.from("run_jobs").insert({
      run_id: freeRun,
      run_kind: "free_audit",
      question_id: paidJob.question_id,
      engine: "chatgpt",
      run_index: 3,
      ...inline,
    });
    expect(withQuestion.error?.code).toBe("23514");
    const wrongKind = await s.from("run_jobs").insert({
      run_id: freeRun,
      run_kind: "audit",
      question_id: paidJob.question_id,
      engine: "chatgpt",
      run_index: 3,
    });
    expect(wrongKind.error?.code).toBe("23503");
    const noText = await s.from("run_jobs").insert({
      run_id: freeRun,
      run_kind: "free_audit",
      engine: "chatgpt",
      run_index: 3,
      location_level: "city",
      country: "US",
    });
    expect(noText.error?.code).toBe("23514");
  });
});

describe("claim and finish with a null question_id", () => {
  it("claims free-audit jobs first, with inline question and snapshot brands, and finishes the run", async () => {
    const { user, businessId } = await paidBusiness("claim-order", 2);
    await drain();
    const paidRun = await createRun(user.db, businessId, "audit");
    const lead = await newLead();
    const { data: freeRun } = await createFree(serviceClient(), freeInput(lead.id, 1));

    const first = await claimJobs(serviceClient(), 10);
    expect(first).toHaveLength(10);
    expect(first.every((j) => j.run_id === freeRun)).toBe(true);
    const cityJob = first.find((j) => j.engine === "gemini")!;
    expect(cityJob.question).toEqual({
      id: null,
      text: "best ramen in Irvine 1",
      location_level: "country",
      country: "US",
      state: null,
      city: null,
      dfs_location_code: null,
    });
    expect(cityJob.business).toEqual({
      id: "business",
      name: "Example Ramen House",
      aliases: ["Example Ramen"],
      domain: "example-ramen.test",
    });
    expect(cityJob.competitors.map((c) => c.name)).toEqual(["Example Noodle Bar", "Example Izakaya"]);

    const paid = await claimJobs(serviceClient(), 50);
    expect(paid.every((j) => j.run_id === paidRun)).toBe(true);
    expect(paid[0].question.id).not.toBeNull();
    expect(paid[0].competitors.map((c) => c.name)).toEqual(["Example Udon House"]);

    const s = serviceClient();
    for (const [i, job] of first.entries()) await finishJob(s, job.job_id, i === 0 ? failed : ok(i % 2 === 0), []);
    expect(must(await s.from("runs").select("status, jobs_ok, jobs_failed").eq("id", freeRun).single())).toEqual({
      status: "partial",
      jobs_ok: 9,
      jobs_failed: 1,
    });
    const answers = must(
      await s.from("answers").select("question_id, job_id, question_text_used").eq("run_id", freeRun),
    );
    expect(answers).toHaveLength(10);
    expect(
      answers.every((a) => a.question_id === null && a.job_id && a.question_text_used === "best ramen in Irvine 1"),
    ).toBe(true);
    await finishJob(s, first[1].job_id, ok(true), []);
    expect(must(await s.from("answers").select("id").eq("run_id", freeRun))).toHaveLength(10);
  });
});

describe("result queries", () => {
  it("getFreeAuditByToken returns the run, snapshot brands, answers and citations, never email or token", async () => {
    const lead = await newLead();
    const { data: runId } = await createFree(serviceClient(), freeInput(lead.id, 1));
    await drain();
    const jobs = must(await serviceClient().from("run_jobs").select("id").eq("run_id", runId));
    for (const [i, job] of jobs.entries()) {
      await finishJob(
        serviceClient(),
        job.id,
        ok(i < 4),
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

    const results = (await getFreeAuditByToken(serviceClient(), lead.token))!;
    expect(results.run).toMatchObject({
      id: runId,
      kind: "free_audit",
      status: "complete",
      jobs_total: 10,
      jobs_ok: 10,
      business_id: null,
    });
    expect(results.label).toBe("example-ramen.test");
    expect(results.brands).toEqual([
      { name: "Example Ramen House", kind: "business", domain: "example-ramen.test" },
      { name: "Example Noodle Bar", kind: "competitor", domain: "example-noodle.test" },
      { name: "Example Izakaya", kind: "competitor", domain: null },
    ]);
    expect(results.answers).toHaveLength(10);
    expect(results.answers.filter((a) => a.mentioned)).toHaveLength(4);
    expect(Object.keys(results.answers[0]).sort()).toEqual(
      [
        "brands",
        "checked_at",
        "engine",
        "first_position",
        "id",
        "location_supported",
        "location_used",
        "mentioned",
        "question_id",
        "question_text_used",
        "run_index",
        "status",
      ].sort(),
    );
    expect(results.citations.map((c) => c.position)).toEqual([1, 2]);
    expect(JSON.stringify(results)).not.toContain(lead.email);
    expect(JSON.stringify(results)).not.toContain(lead.token);

    expect(await getFreeAuditByToken(serviceClient(), randomUUID())).toBeNull();
    const queued = await newLead();
    expect(await getFreeAuditByToken(serviceClient(), queued.token)).toBeNull();
  });

  it("getRunResults returns a member's paid run with business and non-hidden competitors; null for others", async () => {
    const { user, businessId } = await paidBusiness("results-paid");
    await drain();
    const runId = await createRun(user.db, businessId, "audit");
    for (const job of (await drain()).filter((j) => j.run_id === runId))
      await finishJob(serviceClient(), job.job_id, ok(true), []);

    const results = (await getRunResults(user.db, runId))!;
    expect(results.run).toMatchObject({ id: runId, kind: "audit", status: "complete", business_id: businessId });
    expect(results.label).toBe("Example Pho Spot");
    expect(results.brands).toEqual([
      { name: "Example Pho Spot", kind: "business", domain: "example-pho.test" },
      { name: "Example Udon House", kind: "competitor", domain: "example-udon.test" },
    ]);
    expect(results.answers).toHaveLength(10);
    expect(results.answers[0]).not.toHaveProperty("raw");
    expect(results.answers[0]).not.toHaveProperty("cost_usd");

    const stranger = await newUser("results-stranger");
    expect(await getRunResults(stranger.db, runId)).toBeNull();
    expect(await getRunResults(anonClient(), runId)).toBeNull();
  });

  it("getPreviousRun returns the latest earlier complete/partial audit or weekly run", async () => {
    const { user, businessId } = await paidBusiness("results-previous");
    const s = serviceClient();
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
    const close = async (id: string, status: string, h: number) =>
      must(
        await s
          .from("runs")
          .update({ status, started_at: hoursAgo(h) })
          .eq("id", id),
      );

    const oldest = await createRun(s, businessId, "weekly");
    await close(oldest, "complete", 72);
    const failedRun = await createRun(s, businessId, "weekly");
    await close(failedRun, "failed", 48);
    const current = await createRun(user.db, businessId, "audit");

    expect((await getPreviousRun(user.db, businessId, current))?.run.id).toBe(oldest);
    expect(await getPreviousRun(user.db, businessId, oldest)).toBeNull();
    const stranger = await newUser("previous-stranger");
    expect(await getPreviousRun(stranger.db, businessId, current)).toBeNull();
  });
});

describe("free audit notify flow", () => {
  async function finishedFree(answer: FinishAnswer) {
    const lead = await newLead();
    const { data: runId } = await createFree(serviceClient(), freeInput(lead.id, 1));
    await drain();
    for (const job of must(await serviceClient().from("run_jobs").select("id").eq("run_id", runId))) {
      await finishJob(serviceClient(), job.id, answer, []);
    }
    return { lead, runId: runId as string };
  }
  const listed = async (runId: string) =>
    (await listUnnotifiedFreeAudits(serviceClient())).find((a) => a.runId === runId);

  it("lists finished runs (complete, partial, failed) once; marking removes them", async () => {
    const done = await finishedFree(ok(true));
    const failedRun = await finishedFree(failed);
    const lead = await newLead();
    const { data: open } = await createFree(serviceClient(), freeInput(lead.id, 1));

    expect(await listed(done.runId)).toEqual({
      runId: done.runId,
      leadId: done.lead.id,
      email: done.lead.email,
      domain: "example-ramen.test",
      token: done.lead.token,
      status: "complete",
      okAnswers: 10,
    });
    expect((await listed(failedRun.runId))?.status).toBe("failed");
    expect((await listed(failedRun.runId))?.okAnswers).toBe(0);
    expect(await listed(open)).toBeUndefined();

    await markFreeAuditNotified(serviceClient(), done.runId, true);
    await markFreeAuditNotified(serviceClient(), failedRun.runId, false);
    expect(await listed(done.runId)).toBeUndefined();
    expect(await listed(failedRun.runId)).toBeUndefined();
    const rows = must(
      await serviceClient()
        .from("free_audits")
        .select("run_id, notify_sent, notified_at")
        .in("run_id", [done.runId, failedRun.runId]),
    );
    expect(rows.find((r) => r.run_id === done.runId)?.notify_sent).toBe(true);
    expect(rows.find((r) => r.run_id === failedRun.runId)?.notify_sent).toBe(false);
    expect(rows.every((r) => r.notified_at)).toBe(true);
  });

  it("stops listing a run after 5 failed attempts", async () => {
    const { runId } = await finishedFree(ok(false));
    expect(await listUnnotifiedFreeAudits(serviceClient(), 1)).toHaveLength(1);
    for (let i = 0; i < 4; i++) await bumpFreeAuditNotifyAttempts(serviceClient(), runId);
    expect(await listed(runId)).toBeDefined();
    await bumpFreeAuditNotifyAttempts(serviceClient(), runId);
    expect(await listed(runId)).toBeUndefined();
    expect(
      must(await serviceClient().from("free_audits").select("notify_attempts").eq("run_id", runId).single())
        .notify_attempts,
    ).toBe(5);
  });
});
