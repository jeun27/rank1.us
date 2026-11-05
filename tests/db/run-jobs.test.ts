import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { createBusinessOnboarding, type OnboardingInput } from "@/lib/queries/onboarding";
import { claimJobs, createRun, finishJob, recordJobError } from "@/lib/queries/run-jobs";
import type { ClaimedJob, FinishAnswer } from "@/lib/runs/types";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;

const question = (i: number, active = true): OnboardingInput["questions"][number] => ({
  short_text: `best ramen in Irvine ${i}`,
  long_text: `Where can I get great ramen in Irvine, take ${i}?`,
  active_form: i % 2 ? "long" : "short",
  active,
  location_level: "city",
  country: "US",
  state: "CA",
  city: "Irvine",
  template_key: String(i),
});

// A self-serve business with `active` active questions (+ `inactive` inactive), optionally paid.
async function business(tag: string, active: number, opts: { paid?: string | null; inactive?: number } = {}) {
  const user = await newUser(tag);
  const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
  const questions = [
    ...Array.from({ length: active }, (_, i) => question(i + 1)),
    ...Array.from({ length: opts.inactive ?? 0 }, (_, i) => question(100 + i, false)),
  ];
  const businessId = await createBusinessOnboarding(user.db, {
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
      { name: "Example Noodle Bar", domain: "example-noodle.test", source: "maps" },
      { name: "Example Hidden", source: "manual" },
    ],
    questions,
  });
  const s = serviceClient();
  must(await s.from("competitors").update({ hidden: true }).eq("business_id", businessId).eq("name", "Example Hidden"));
  if (opts.paid !== null) {
    must(
      await s
        .from("workspaces")
        .update({ subscription_status: opts.paid ?? "active" })
        .eq("id", workspaceId),
    );
  }
  return { user, workspaceId, businessId };
}

const jobsOf = async (runId: string) => must(await serviceClient().from("run_jobs").select("*").eq("run_id", runId));
const runOf = async (runId: string) => must(await serviceClient().from("runs").select("*").eq("id", runId).single());

// Claims every claimable job so later tests start from an empty queue.
async function drain() {
  const all: ClaimedJob[] = [];
  for (;;) {
    const batch = await claimJobs(serviceClient(), 500);
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

const ok = (mentioned: boolean, extra: Partial<FinishAnswer> = {}): FinishAnswer => ({
  status: "ok",
  text: "Example answer naming Example Ramen House.",
  location_used: "Irvine,California,United States",
  location_supported: "exact",
  mentioned,
  first_position: mentioned ? 1 : null,
  brands: [{ name: "Example Ramen House", kind: "business", mentioned, position: mentioned ? 1 : null }],
  cost_usd: 0.002,
  raw: { example: true },
  checked_at: new Date().toISOString(),
  ...extra,
});
const failed: FinishAnswer = {
  ...ok(false),
  status: "failed",
  text: null,
  mentioned: null,
  first_position: null,
  brands: null,
  cost_usd: null,
  error: "timeout",
};
const noOverview: FinishAnswer = {
  ...ok(false),
  status: "no_overview",
  text: null,
  mentioned: null,
  first_position: null,
  brands: null,
};

// A paid business with one active question = one run of 10 jobs, all claimed.
async function claimedRun(tag: string) {
  const { user, businessId } = await business(tag, 1);
  await drain();
  const runId = await createRun(user.db, businessId, "audit");
  const jobs = (await drain()).filter((j) => j.run_id === runId);
  expect(jobs).toHaveLength(10);
  return { runId, jobs, businessId };
}

describe("create_run", () => {
  it("makes 10 jobs per active question, 3/3/3/1 by engine: 250 for 25 questions", async () => {
    const { user, businessId } = await business("run-250", 25, { inactive: 2 });
    const runId = await createRun(user.db, businessId, "audit");
    const run = await runOf(runId);
    expect(run).toMatchObject({
      business_id: businessId,
      kind: "audit",
      status: "queued",
      jobs_total: 250,
      jobs_ok: 0,
      jobs_failed: 0,
    });
    expect(run.started_at).not.toBeNull();
    const jobs = await jobsOf(runId);
    expect(jobs).toHaveLength(250);
    const byEngine = (e: string) => jobs.filter((j) => j.engine === e);
    expect(
      [byEngine("chatgpt"), byEngine("gemini"), byEngine("google_aio"), byEngine("perplexity")].map((x) => x.length),
    ).toEqual([75, 75, 75, 25]);
    expect(new Set(byEngine("chatgpt").map((j) => j.run_index))).toEqual(new Set([1, 2, 3]));
    expect(new Set(byEngine("perplexity").map((j) => j.run_index))).toEqual(new Set([1]));
    expect(jobs.every((j) => j.status === "queued" && j.attempts === 0)).toBe(true);
  });

  it("allows trialing workspaces and the service role", async () => {
    const trial = await business("run-trial", 1, { paid: "trialing" });
    await createRun(trial.user.db, trial.businessId, "weekly");
    const other = await business("run-service", 2);
    const runId = await createRun(serviceClient(), other.businessId, "weekly");
    expect(await jobsOf(runId)).toHaveLength(20);
  });

  it("refuses unpaid workspaces with P0402, unless the business is dfy", async () => {
    for (const status of [null, "past_due", "canceled"]) {
      const { user, businessId } = await business(`run-unpaid-${status}`, 1, { paid: status });
      await expect(createRun(user.db, businessId, "audit")).rejects.toMatchObject({ code: "P0402" });
    }
    const dfy = await business("run-dfy", 1, { paid: null });
    must(await serviceClient().from("businesses").update({ service: "dfy" }).eq("id", dfy.businessId));
    const runId = await createRun(dfy.user.db, dfy.businessId, "audit");
    expect(await jobsOf(runId)).toHaveLength(10);
  });

  it("refuses non-members and anon with 42501", async () => {
    const { businessId } = await business("run-owner", 1);
    const stranger = await newUser("run-stranger");
    await expect(createRun(stranger.db, businessId, "audit")).rejects.toMatchObject({ code: "42501" });
    await expect(createRun(anonClient(), businessId, "audit")).rejects.toMatchObject({ code: "42501" });
  });

  it("refuses a second run while one is queued or running (P0409)", async () => {
    const { user, businessId } = await business("run-twice", 1);
    await createRun(user.db, businessId, "audit");
    await expect(createRun(user.db, businessId, "weekly")).rejects.toMatchObject({ code: "P0409" });
  });

  it("refuses free_audit, an unknown kind, no active questions and archived businesses (22023)", async () => {
    const { user, businessId } = await business("run-kind", 1);
    for (const kind of ["free_audit", "daily"]) {
      await expect(createRun(user.db, businessId, kind as never)).rejects.toMatchObject({ code: "22023" });
    }
    const empty = await business("run-empty", 0, { inactive: 3 });
    await expect(createRun(empty.user.db, empty.businessId, "audit")).rejects.toMatchObject({ code: "22023" });
    must(
      await serviceClient().from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", businessId),
    );
    await expect(createRun(user.db, businessId, "audit")).rejects.toMatchObject({ code: "22023" });
  });
});

describe("run_jobs access", () => {
  it("members and anon cannot read or write jobs, or call the worker functions", async () => {
    const { user, businessId } = await business("jobs-private", 1);
    const runId = await createRun(user.db, businessId, "audit");
    const [job] = await jobsOf(runId);
    for (const db of [user.db, anonClient()]) {
      expect((await loose(db).from("run_jobs").select("*")).error?.code).toBe("42501");
      expect(
        (
          await loose(db)
            .from("run_jobs")
            .insert({ run_id: runId, question_id: job.question_id, engine: "chatgpt", run_index: 1 })
        ).error?.code,
      ).toBe("42501");
      await expect(claimJobs(db as TestUser["db"], 5)).rejects.toMatchObject({ code: "42501" });
      await expect(finishJob(db as TestUser["db"], job.id, ok(true), [])).rejects.toMatchObject({ code: "42501" });
      await expect(recordJobError(db as TestUser["db"], job.id, "x")).rejects.toMatchObject({ code: "42501" });
    }
  });
});

describe("claim_jobs", () => {
  it("is exclusive under parallel calls and returns the worker payload", async () => {
    const { user, businessId } = await business("claim-parallel", 25);
    await drain();
    const runId = await createRun(user.db, businessId, "audit");
    const batches = await Promise.all(Array.from({ length: 6 }, () => claimJobs(serviceClient(), 50)));
    const claimed = batches.flat().filter((j) => j.run_id === runId);
    expect(claimed).toHaveLength(250);
    expect(new Set(claimed.map((j) => j.job_id)).size).toBe(250);
    expect(await claimJobs(serviceClient(), 50)).toEqual([]);

    const jobs = await jobsOf(runId);
    expect(jobs.every((j) => j.status === "running" && j.attempts === 1 && j.locked_at)).toBe(true);
    expect((await runOf(runId)).status).toBe("running");

    const sample = claimed.find((j) => j.question.text.startsWith("Where"))!;
    expect(sample).toMatchObject({
      attempt: 1,
      question: { location_level: "city", country: "US", state: "CA", city: "Irvine" },
      business: {
        id: businessId,
        name: "Example Ramen House",
        aliases: ["Example Ramen"],
        domain: "example-ramen.test",
      },
      competitors: [{ name: "Example Noodle Bar", aliases: [], domain: "example-noodle.test" }],
    });
    expect(claimed.some((j) => j.question.text.startsWith("best ramen"))).toBe(true);
  });

  it("re-claims a job whose lock went stale, and fails it after 3 attempts", async () => {
    const { runId, jobs } = await claimedRun("claim-stale");
    const s = serviceClient();
    const stale = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    const target = jobs[0].job_id;

    must(await s.from("run_jobs").update({ locked_at: stale }).eq("id", target));
    const again = await claimJobs(s, 50);
    expect(again.map((j) => j.job_id)).toEqual([target]);
    expect(again[0].attempt).toBe(2);

    must(await s.from("run_jobs").update({ locked_at: stale, attempts: 3 }).eq("id", target));
    expect(await claimJobs(s, 50)).toEqual([]);
    const [job] = must(await s.from("run_jobs").select("status, locked_at, last_error").eq("id", target));
    expect(job).toEqual({ status: "failed", locked_at: null, last_error: "Gave up after 3 attempts" });
    const answers = must(await s.from("answers").select("status, mentioned, question_text_used").eq("run_id", runId));
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({ status: "failed", mentioned: null });
    expect(answers[0].question_text_used).toMatch(/ramen/);
    expect(await runOf(runId)).toMatchObject({ status: "running", jobs_ok: 0, jobs_failed: 1 });
  });
});

describe("finish_job", () => {
  it("stores the answer and citations, deduping repeated URLs, and closes the job", async () => {
    const { runId, jobs } = await claimedRun("finish-store");
    const s = serviceClient();
    const job = jobs[0];
    const citation = {
      url: "https://www.yelp.com/biz/example-ramen",
      domain: "yelp.com",
      title: "Example",
      position: 1,
      category: "review_directory" as const,
    };
    await finishJob(s, job.job_id, ok(true, { cost_usd: 0.004 }), [
      citation,
      { ...citation, position: 2 },
      { ...citation, url: "https://example-guide.test/a", domain: "example-guide.test", position: 3, category: null },
    ]);

    const [answer] = must(await s.from("answers").select("*").eq("run_id", runId));
    expect(answer).toMatchObject({
      question_id: job.question.id,
      engine: job.engine,
      run_index: job.run_index,
      status: "ok",
      mentioned: true,
      first_position: 1,
      location_supported: "exact",
      cost_usd: 0.004,
      question_text_used: job.question.text,
    });
    const citations = must(
      await s.from("citations").select("url, position").eq("answer_id", answer.id).order("position"),
    );
    expect(citations).toEqual([
      { url: "https://www.yelp.com/biz/example-ramen", position: 1 },
      { url: "https://example-guide.test/a", position: 3 },
    ]);
    const [row] = must(await s.from("run_jobs").select("status, locked_at").eq("id", job.job_id));
    expect(row).toEqual({ status: "done", locked_at: null });
    expect(await runOf(runId)).toMatchObject({
      status: "running",
      jobs_ok: 1,
      jobs_failed: 0,
      cost_usd: 0.004,
      finished_at: null,
    });
  });

  it("is idempotent: finishing a job twice stores one answer", async () => {
    const { runId, jobs } = await claimedRun("finish-twice");
    await finishJob(serviceClient(), jobs[0].job_id, ok(true), []);
    await finishJob(serviceClient(), jobs[0].job_id, ok(false), []);
    const answers = must(await serviceClient().from("answers").select("mentioned").eq("run_id", runId));
    expect(answers).toEqual([{ mentioned: true }]);
  });

  it("is atomic: a bad citation stores nothing and leaves the job running", async () => {
    const { runId, jobs } = await claimedRun("finish-atomic");
    const bad = [{ url: null, domain: "x.test", title: null, position: 1, category: null }] as never;
    await expect(finishJob(serviceClient(), jobs[0].job_id, ok(true), bad)).rejects.toMatchObject({ code: "23502" });
    expect(must(await serviceClient().from("answers").select("id").eq("run_id", runId))).toEqual([]);
    const [row] = must(await serviceClient().from("run_jobs").select("status").eq("id", jobs[0].job_id));
    expect(row.status).toBe("running");
  });

  it("rejects an unknown answer status (22023)", async () => {
    const { jobs } = await claimedRun("finish-status");
    await expect(
      finishJob(serviceClient(), jobs[0].job_id, { ...ok(true), status: "maybe" as never }, []),
    ).rejects.toMatchObject({ code: "22023" });
  });

  it("all ok: complete, with finished_at", async () => {
    const { runId, jobs } = await claimedRun("finish-complete");
    for (const job of jobs) await finishJob(serviceClient(), job.job_id, ok(true), []);
    const run = await runOf(runId);
    expect(run).toMatchObject({ status: "complete", jobs_ok: 10, jobs_failed: 0 });
    expect(run.finished_at).not.toBeNull();
  });

  it("ok + no_overview + failed: partial; no_overview counts as ok; the failure is stored as failed", async () => {
    const { runId, jobs } = await claimedRun("finish-partial");
    const s = serviceClient();
    const results = [...Array(7).fill(ok(false)), noOverview, noOverview, failed];
    for (let i = 0; i < jobs.length; i++) {
      await finishJob(s, jobs[i].job_id, results[i], []);
      if (i < jobs.length - 1) expect((await runOf(runId)).status).toBe("running");
    }
    const run = await runOf(runId);
    expect(run).toMatchObject({ status: "partial", jobs_ok: 9, jobs_failed: 1 });
    expect(run.finished_at).not.toBeNull();
    const failedAnswer = must(
      await s.from("answers").select("status, mentioned, text").eq("run_id", runId).eq("status", "failed"),
    );
    expect(failedAnswer).toEqual([{ status: "failed", mentioned: null, text: null }]);
    const [job] = must(await s.from("run_jobs").select("last_error").eq("id", jobs[9].job_id));
    expect(job.last_error).toBe("timeout");
  });

  it("every job failed: failed", async () => {
    const { runId, jobs } = await claimedRun("finish-failed");
    for (const job of jobs) await finishJob(serviceClient(), job.job_id, failed, []);
    expect(await runOf(runId)).toMatchObject({ status: "failed", jobs_ok: 0, jobs_failed: 10 });
  });

  it("only no_overview answers: complete (no_overview counts as ok)", async () => {
    const { runId, jobs } = await claimedRun("finish-no-overview");
    for (const job of jobs) await finishJob(serviceClient(), job.job_id, noOverview, []);
    expect(await runOf(runId)).toMatchObject({ status: "complete", jobs_ok: 10, jobs_failed: 0 });
  });

  it("job_error records an error without finishing the job", async () => {
    const { jobs } = await claimedRun("job-error");
    await recordJobError(serviceClient(), jobs[0].job_id, "finish_job failed: network");
    const [row] = must(await serviceClient().from("run_jobs").select("status, last_error").eq("id", jobs[0].job_id));
    expect(row).toEqual({ status: "running", last_error: "finish_job failed: network" });
  });
});
