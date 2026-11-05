import { describe, expect, it, vi } from "vitest";
import { runEngine } from "@/lib/engines";
import type { EngineAnswer } from "@/lib/engines/types";
import { processJob, type ClaimedJob, type RunsDb } from "@/lib/runs";
import { KEYS, NOW, fakeFetch, fixture, hangingFetch } from "../engines/helpers";

const job = (engine: ClaimedJob["engine"]): ClaimedJob => ({
  job_id: "job-1",
  run_id: "run-1",
  engine,
  run_index: 1,
  attempt: 1,
  question: {
    id: "q-1",
    text: "best ramen in Irvine",
    location_level: "city",
    country: "US",
    state: "CA",
    city: "Irvine",
    dfs_location_code: null,
  },
  business: { id: "b-1", name: "Example Ramen House", aliases: [], domain: "example-ramen-house.test" },
  competitors: [
    { id: "c-1", name: "Example Tonkotsu Co.", aliases: [], domain: null },
    { id: "c-2", name: "Example Izakaya", aliases: [], domain: null },
  ],
});

function db(overrides = {}, finishError?: string) {
  const d = {
    finishJob: vi.fn<RunsDb["finishJob"]>(async () => {
      if (finishError) throw new Error(finishError);
    }),
    manualCategories: vi.fn<RunsDb["manualCategories"]>(async () => overrides),
    recordJobError: vi.fn<RunsDb["recordJobError"]>(async () => {}),
  };
  return d;
}
const engineWith = (body: unknown, status = 200) =>
  ((engine, req) =>
    runEngine(engine, req, { fetch: fakeFetch(body, status), env: KEYS, now: NOW })) as typeof runEngine;

describe("processJob", () => {
  it("ok: stores the answer with mentions and deduped, categorized citations", async () => {
    const d = db({ "example-blog.test": "news_blog" });
    const res = await processJob(job("perplexity"), {
      db: d,
      runEngine: engineWith(fixture("perplexity/synthetic-restaurant-web-search.json")),
    });
    expect(res).toEqual({ jobId: "job-1", status: "ok", finished: true });
    const [id, answer, citations] = d.finishJob.mock.calls[0];
    expect(id).toBe("job-1");
    expect(answer).toMatchObject({
      status: "ok",
      question_text_used: "best ramen in Irvine",
      location_used: "Irvine, California, United States",
      location_supported: "exact",
      mentioned: true,
      first_position: 1,
      cost_usd: 0.0061,
      checked_at: "2026-11-05T12:00:00.000Z",
    });
    expect(answer.brands).toEqual([
      { name: "Example Ramen House", kind: "business", mentioned: true, position: 1 },
      { name: "Example Tonkotsu Co.", kind: "competitor", mentioned: true, position: 2 },
      { name: "Example Izakaya", kind: "competitor", mentioned: false, position: null },
    ]);
    expect(citations).toEqual([
      {
        url: "https://example-reviews.test/irvine/ramen",
        domain: "example-reviews.test",
        title: "Example data: best ramen in Irvine",
        position: 1,
        category: "other",
      },
      {
        url: "https://example-blog.test/ramen-guide",
        domain: "example-blog.test",
        title: "Example data: ramen guide",
        position: 2,
        category: "news_blog",
      },
    ]);
    expect(d.manualCategories).toHaveBeenCalledWith(["example-reviews.test", "example-blog.test"]);
  });

  it("ChatGPT at city level stores fallback_country", async () => {
    const d = db();
    await processJob(job("chatgpt"), { db: d, runEngine: engineWith(fixture("chatgpt/synthetic-live-advanced.json")) });
    expect(d.finishJob.mock.calls[0][1]).toMatchObject({
      status: "ok",
      location_supported: "fallback_country",
      location_used: "US",
    });
  });

  it("no_overview: stored, with null mentions and no citations", async () => {
    const d = db();
    const res = await processJob(job("google_aio"), {
      db: d,
      runEngine: engineWith(fixture("google_aio/synthetic-no-overview.json")),
    });
    expect(res.status).toBe("no_overview");
    const [, answer, citations] = d.finishJob.mock.calls[0];
    expect(answer).toMatchObject({
      status: "no_overview",
      mentioned: null,
      first_position: null,
      brands: null,
      cost_usd: 0.002,
    });
    expect(citations).toEqual([]);
    expect(d.manualCategories).not.toHaveBeenCalled();
  });

  it.each([
    ["HTTP 500", () => engineWith({ x: 1 }, 500), "HTTP 500"],
    [
      "DataForSEO 40501",
      () => engineWith(fixture("dataforseo/synthetic-task-error-40501.json")),
      "DataForSEO task 40501: Invalid Field.",
    ],
    [
      "timeout",
      () =>
        ((e: never, r: never) =>
          runEngine(e, r, { fetch: hangingFetch(), env: KEYS, now: NOW, timeoutMs: 10 })) as typeof runEngine,
      "timeout after 10 ms",
    ],
  ])("engine failure (%s) → a failed answer row, finished", async (_, make, error) => {
    const d = db();
    const res = await processJob(job("chatgpt"), { db: d, runEngine: make() });
    expect(res).toEqual({ jobId: "job-1", status: "failed", finished: true });
    const [, answer, citations] = d.finishJob.mock.calls[0];
    expect(answer).toMatchObject({
      status: "failed",
      text: null,
      mentioned: null,
      brands: null,
      first_position: null,
      error,
      raw: null,
    });
    expect(citations).toEqual([]);
  });

  it("a runEngine that throws is still stored as failed, never thrown", async () => {
    const d = db();
    const boom = (async () => {
      throw new Error("kaboom");
    }) as unknown as typeof runEngine;
    const res = await processJob(job("gemini"), { db: d, runEngine: boom });
    expect(res).toMatchObject({ status: "failed", finished: true });
    expect(d.finishJob.mock.calls[0][1]).toMatchObject({ status: "failed", error: "worker: kaboom", raw: null });
  });

  it("finish_job error → not finished, error recorded on the job, never thrown", async () => {
    const d = db({}, "deadlock detected");
    const res = await processJob(job("perplexity"), {
      db: d,
      runEngine: engineWith(fixture("perplexity/synthetic-restaurant-web-search.json")),
    });
    expect(res).toEqual({ jobId: "job-1", status: "ok", finished: false, error: "finish_job: deadlock detected" });
    expect(d.recordJobError).toHaveBeenCalledWith("job-1", "finish_job: deadlock detected");
  });

  it("a recordJobError that throws synchronously still doesn't throw", async () => {
    const d = db({}, "x");
    d.recordJobError.mockImplementation((() => {
      throw new Error("sync");
    }) as never);
    const res = await processJob(job("perplexity"), {
      db: d,
      runEngine: engineWith(fixture("perplexity/synthetic-restaurant-web-search.json")),
    });
    expect(res).toMatchObject({ finished: false, error: "finish_job: x" });
  });

  it("a throwing db (and a throwing recordJobError) still doesn't throw", async () => {
    const d = db();
    d.manualCategories.mockRejectedValue(new Error("network"));
    d.recordJobError.mockRejectedValue(new Error("also down"));
    const res = await processJob(job("perplexity"), {
      db: d,
      runEngine: engineWith(fixture("perplexity/synthetic-restaurant-web-search.json")),
    });
    expect(res).toMatchObject({ finished: false, error: "finish_job: network" });
  });

  it("an ok answer naming no brand → mentioned false, first_position null, unknown cost stored as null", async () => {
    const d = db();
    const answer: EngineAnswer = {
      status: "ok",
      text: "Nothing relevant here.",
      citations: [],
      locationUsed: "US",
      locationSupported: "exact",
      costUsd: null,
      raw: {},
      checkedAt: NOW().toISOString(),
    };
    await processJob(job("gemini"), { db: d, runEngine: (async () => answer) as unknown as typeof runEngine });
    expect(d.finishJob.mock.calls[0][1]).toMatchObject({ mentioned: false, first_position: null, cost_usd: null });
  });
});
