import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const q = vi.hoisted(() => ({ claimJobs: vi.fn(), finishJob: vi.fn(), recordJobError: vi.fn() }));
vi.mock("@/lib/queries/run-jobs", () => q);
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
}));
const runEngine = vi.hoisted(() => vi.fn());
const NOTIFIED = { sent: 0, failedRuns: 0, sendErrors: 0, skipped: false };
const notify = vi.hoisted(() => ({ notifyFreeAuditsWith: vi.fn(), startFreeAuditWith: vi.fn() }));
vi.mock("@/lib/audit/service", () => notify);
const FIXES = { checked: null, skipped: "none" };
const fixes = vi.hoisted(() => ({ checkFixesWith: vi.fn() }));
vi.mock("@/lib/fixes/service", () => fixes);
vi.mock("@/lib/engines", async (real) => ({ ...(await real<object>()), runEngine }));

const { GET } = await import("@/app/api/cron/run-jobs/route");

const SECRET = "cron-secret-0123456789";
const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/run-jobs", { headers: auth ? { authorization: auth } : {} }));
const claimed = (i: number) => ({
  job_id: `job-${i}`,
  run_id: "run-1",
  engine: "gemini",
  run_index: 1,
  attempt: 1,
  question: {
    id: "q",
    text: "best ramen in Irvine",
    location_level: "country",
    country: "US",
    state: null,
    city: null,
    dfs_location_code: null,
  },
  business: { id: "b", name: "Example Ramen House", aliases: [], domain: null },
  competitors: [],
});

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("RUN_JOBS_BATCH", "");
  for (const f of Object.values(q)) f.mockReset();
  notify.notifyFreeAuditsWith.mockReset().mockResolvedValue(NOTIFIED);
  fixes.checkFixesWith.mockReset().mockResolvedValue(FIXES);
  runEngine.mockReset().mockResolvedValue({
    status: "ok",
    text: "Example Ramen House is great.",
    citations: [],
    locationUsed: "US",
    locationSupported: "exact",
    costUsd: 0.004,
    raw: {},
    checkedAt: "2026-11-05T12:00:00.000Z",
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/run-jobs", () => {
  it.each([undefined, "", "Bearer wrong", `bearer ${SECRET}`, SECRET, `Bearer ${SECRET}x`, `Bearer  ${SECRET}`])(
    "401 for authorization %j",
    async (auth) => {
      const res = await call(auth);
      expect(res.status).toBe(401);
      expect(q.claimJobs).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, ""])("401 for everyone while CRON_SECRET is %j", async (secret) => {
    vi.stubEnv("CRON_SECRET", secret);
    for (const auth of ["Bearer ", "Bearer undefined", `Bearer ${SECRET}`]) expect((await call(auth)).status).toBe(401);
    expect(q.claimJobs).not.toHaveBeenCalled();
  });

  it("claims in chunks of 5 up to RUN_JOBS_BATCH (default 20) and finishes each job", async () => {
    let n = 0;
    q.claimJobs.mockImplementation(async (_db: unknown, limit: number) =>
      Array.from({ length: limit }, () => claimed(n++)),
    );
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      claimed: 20,
      finished: 20,
      unfinished: 0,
      stopped: "batch",
      notified: NOTIFIED,
      fixes: FIXES,
    });
    expect(q.claimJobs.mock.calls.map((c) => c[1])).toEqual([5, 5, 5, 5]);
    expect(q.finishJob).toHaveBeenCalledTimes(20);
    expect(q.finishJob.mock.calls[0][2]).toMatchObject({ status: "ok", mentioned: true, first_position: 1 });
  });

  it("honors RUN_JOBS_BATCH and stops on an empty queue", async () => {
    vi.stubEnv("RUN_JOBS_BATCH", "8");
    q.claimJobs.mockResolvedValueOnce([claimed(1), claimed(2), claimed(3)]).mockResolvedValueOnce([]);
    expect(await (await call(`Bearer ${SECRET}`)).json()).toEqual({
      claimed: 3,
      finished: 3,
      unfinished: 0,
      stopped: "empty",
      notified: NOTIFIED,
      fixes: FIXES,
    });
    expect(q.claimJobs.mock.calls.map((c) => c[1])).toEqual([5, 5]);
  });

  it("stops claiming once the time budget is spent", async () => {
    let t = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => t);
    let n = 0;
    q.claimJobs.mockImplementation(async (_db: unknown, limit: number) =>
      Array.from({ length: limit }, () => claimed(n++)),
    );
    runEngine.mockImplementation(async () => {
      t += 40_000; // each live call takes 40 s of fake time; a parallel chunk of 5 passes the 150 s budget
      return {
        status: "ok",
        text: "",
        citations: [],
        locationUsed: "US",
        locationSupported: "exact",
        costUsd: null,
        raw: {},
        checkedAt: "2026-11-05T12:00:00.000Z",
      };
    });
    expect(await (await call(`Bearer ${SECRET}`)).json()).toEqual({
      claimed: 5,
      finished: 5,
      unfinished: 0,
      stopped: "budget",
      notified: NOTIFIED,
      fixes: FIXES,
    });
    expect(q.claimJobs).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("a finish_job failure is recorded on the job, and the batch continues", async () => {
    q.claimJobs.mockResolvedValueOnce([claimed(1), claimed(2)]).mockResolvedValueOnce([]);
    q.finishJob.mockRejectedValueOnce({ message: "deadlock detected", code: "40P01" });
    expect(await (await call(`Bearer ${SECRET}`)).json()).toEqual({
      claimed: 2,
      finished: 1,
      unfinished: 1,
      stopped: "empty",
      notified: NOTIFIED,
      fixes: FIXES,
    });
    expect(q.recordJobError).toHaveBeenCalledWith(expect.anything(), "job-1", "finish_job: deadlock detected");
  });

  it("emails finished free audits after the drain, even with an empty queue", async () => {
    q.claimJobs.mockResolvedValue([]);
    notify.notifyFreeAuditsWith.mockResolvedValue({ ...NOTIFIED, sent: 2 });
    const body = await (await call(`Bearer ${SECRET}`)).json();
    expect(body.notified).toEqual({ ...NOTIFIED, sent: 2 });
    expect(notify.notifyFreeAuditsWith).toHaveBeenCalledTimes(1);
  });

  it("never notifies or runs fix checks on a 401", async () => {
    await call("Bearer nope");
    expect(notify.notifyFreeAuditsWith).not.toHaveBeenCalled();
    expect(fixes.checkFixesWith).not.toHaveBeenCalled();
  });

  it("runs fix checks after the drain and notify, passing the time left of maxDuration (300 s)", async () => {
    q.claimJobs.mockResolvedValue([]);
    fixes.checkFixesWith.mockImplementation(async (_db: unknown, timeLeftMs: () => number) => {
      const left = timeLeftMs();
      expect(left).toBeGreaterThan(299_000);
      expect(left).toBeLessThanOrEqual(300_000);
      return { checked: "run-9" };
    });
    const body = await (await call(`Bearer ${SECRET}`)).json();
    expect(body.fixes).toEqual({ checked: "run-9" });
    const order = [
      notify.notifyFreeAuditsWith.mock.invocationCallOrder[0],
      fixes.checkFixesWith.mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
  });

  it("time left shrinks with the drain: a long drain leaves under 60 s", async () => {
    let t = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => t);
    q.claimJobs.mockImplementation(async () => {
      t += 250_000;
      return [];
    });
    fixes.checkFixesWith.mockImplementation(async (_db: unknown, timeLeftMs: () => number) => ({ left: timeLeftMs() }));
    expect((await (await call(`Bearer ${SECRET}`)).json()).fixes).toEqual({ left: 50_000 });
    vi.restoreAllMocks();
  });

  it("claim_jobs failing → 500 with a short error, nothing thrown", async () => {
    q.claimJobs.mockRejectedValue({ message: "permission denied for function claim_jobs" });
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "claim_jobs: permission denied for function claim_jobs" });
  });
});
