import { describe, expect, it, vi } from "vitest";
import { batchSize, cronAuthorized, drainJobs } from "@/lib/runs/drain";
import type { ClaimedJob, ProcessResult } from "@/lib/runs/process-job";

const jobs = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `job-${from + i}` }) as unknown as ClaimedJob);

// A queue of `total` jobs; each claim takes up to `limit` from the front.
function queue(total: number) {
  let next = 0;
  const claim = vi.fn(async (limit: number) => {
    const out = jobs(Math.max(0, Math.min(limit, total - next)), next);
    next += out.length;
    return out;
  });
  return claim;
}
const done = vi.fn(async (j: ClaimedJob): Promise<ProcessResult> => ({ jobId: j.id, status: "ok", finished: true }));

describe("cronAuthorized", () => {
  it("accepts only the exact Bearer secret", () => {
    expect(cronAuthorized("Bearer s3cret-value-123456", "s3cret-value-123456")).toBe(true);
    for (const h of [
      null,
      "",
      "s3cret-value-123456",
      "bearer s3cret-value-123456",
      "Bearer s3cret-value-12345",
      "Bearer  s3cret-value-123456",
      "Basic s3cret-value-123456",
    ])
      expect(cronAuthorized(h, "s3cret-value-123456"), String(h)).toBe(false);
  });

  it("rejects everything when the secret is unset or blank", () => {
    for (const secret of [undefined, "", "   "]) {
      expect(cronAuthorized("Bearer ", secret)).toBe(false);
      expect(cronAuthorized("Bearer undefined", secret)).toBe(false);
      expect(cronAuthorized(`Bearer ${secret}`, secret)).toBe(false);
    }
  });
});

describe("batchSize", () => {
  it("defaults to 20 and caps at 100", () => {
    expect(batchSize(undefined)).toBe(20);
    expect(batchSize("abc")).toBe(20);
    expect(batchSize("0")).toBe(20);
    expect(batchSize("-3")).toBe(20);
    expect(batchSize("7")).toBe(7);
    expect(batchSize("1000")).toBe(100);
  });
});

describe("drainJobs", () => {
  it("claims in chunks of 5 up to the batch", async () => {
    const claim = queue(100);
    const s = await drainJobs({ claim, process: done, batch: 20 });
    expect(claim.mock.calls.map((c) => c[0])).toEqual([5, 5, 5, 5]);
    expect(s).toEqual({ claimed: 20, finished: 20, unfinished: 0, stopped: "batch" });
  });

  it("asks only for what's left of the batch", async () => {
    const claim = queue(100);
    await drainJobs({ claim, process: done, batch: 7 });
    expect(claim.mock.calls.map((c) => c[0])).toEqual([5, 2]);
  });

  it("stops when the queue is empty", async () => {
    const claim = queue(8);
    const s = await drainJobs({ claim, process: done, batch: 20 });
    expect(claim.mock.calls.map((c) => c[0])).toEqual([5, 5, 5]);
    expect(s).toEqual({ claimed: 8, finished: 8, unfinished: 0, stopped: "empty" });
  });

  it("stops claiming once the time budget is spent", async () => {
    let t = 0;
    const claim = queue(100);
    const slow = vi.fn(async (j: ClaimedJob): Promise<ProcessResult> => {
      t += 60_000;
      return { jobId: j.id, status: "ok", finished: true };
    });
    const s = await drainJobs({ claim, process: slow, batch: 20, budgetMs: 150_000, now: () => t });
    // Chunk 1 ends at 300 s of fake time (5 × 60 s, parallel calls each add time), so no chunk 2.
    expect(claim).toHaveBeenCalledTimes(1);
    expect(s).toMatchObject({ claimed: 5, stopped: "budget" });
  });

  it("counts unfinished jobs (finish_job errors) and keeps going", async () => {
    const claim = queue(10);
    const flaky = vi.fn(async (j: ClaimedJob): Promise<ProcessResult> => ({
      jobId: j.id,
      status: "ok",
      finished: j.id !== "job-3",
      ...(j.id === "job-3" ? { error: "finish_job: x" } : {}),
    }));
    expect(await drainJobs({ claim, process: flaky, batch: 20 })).toEqual({
      claimed: 10,
      finished: 9,
      unfinished: 1,
      stopped: "empty",
    });
  });

  it("processes a chunk in parallel", async () => {
    let active = 0;
    let peak = 0;
    const claim = queue(5);
    const proc = vi.fn(async (j: ClaimedJob): Promise<ProcessResult> => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { jobId: j.id, status: "ok", finished: true };
    });
    await drainJobs({ claim, process: proc, batch: 20 });
    expect(peak).toBe(5);
  });
});
