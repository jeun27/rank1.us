import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const q = vi.hoisted(() => ({ enqueueWeeklyRuns: vi.fn(), pruneEphemeral: vi.fn() }));
vi.mock("@/lib/queries/weekly", async (real) => ({ ...(await real<object>()), ...q }));
const svc = vi.hoisted(() => ({ createServiceClient: vi.fn(() => ({})) }));
vi.mock("@/lib/supabase/service", () => svc);

const { GET } = await import("@/app/api/cron/weekly/route");

const SECRET = "cron-secret-0123456789";
const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/weekly", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T14:05:00Z")); // Monday 06:05 PST
  vi.stubEnv("CRON_SECRET", SECRET);
  q.enqueueWeeklyRuns.mockReset().mockResolvedValue({ enqueued: 4, skipped: 1, failed: 0 });
  q.pruneEphemeral.mockReset().mockResolvedValue({ lookup_cache: 9, rate_events: 120 });
  svc.createServiceClient.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/weekly", () => {
  it.each([undefined, "", "Bearer wrong", `bearer ${SECRET}`, SECRET, `Bearer ${SECRET}x`])(
    "401 for authorization %j, no DB",
    async (auth) => {
      expect((await call(auth)).status).toBe(401);
      expect(svc.createServiceClient).not.toHaveBeenCalled();
    },
  );

  it("401 for everyone while CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(`Bearer ${SECRET}`)).status).toBe(401);
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("in the window: enqueues for the LA week, prunes, 200 with counts", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      week_start: "2026-11-02",
      enqueued: 4,
      skipped: 1,
      failed: 0,
      pruned: { lookup_cache: 9, rate_events: 120 },
    });
    expect(q.enqueueWeeklyRuns).toHaveBeenCalledWith(expect.anything(), "2026-11-02");
  });

  it("the other Monday fire (13:00 UTC in PST) is a no-op: no DB client at all", async () => {
    vi.setSystemTime(new Date("2026-11-02T13:00:00Z"));
    const res = await call(`Bearer ${SECRET}`);
    expect(await res.json()).toEqual({ skipped: "outside_window" });
    expect(svc.createServiceClient).not.toHaveBeenCalled();
    expect(q.enqueueWeeklyRuns).not.toHaveBeenCalled();
    expect(q.pruneEphemeral).not.toHaveBeenCalled();
  });

  it("enqueue error → prune still runs → 500 with no DB text; the log has codes only", async () => {
    q.enqueueWeeklyRuns.mockRejectedValue({
      code: "22023",
      message: "week_start 2026-11-02 is not the current week's Monday",
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "enqueue_failed" });
    expect(q.pruneEphemeral).toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith("weekly 2026-11-02: enqueue_error=22023 pruned lookup_cache=9 rate_events=120");
    expect(JSON.stringify([body, err.mock.calls])).not.toContain("not the current week");
  });

  it("prune error → 500 prune_failed, no DB text", async () => {
    q.pruneEphemeral.mockRejectedValue({ code: "42501", message: "permission denied for function prune_ephemeral" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "prune_failed" });
  });
});
