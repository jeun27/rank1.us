import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const q = vi.hoisted(() => ({ enqueueMonthlyReports: vi.fn() }));
vi.mock("@/lib/queries/reports", async (real) => ({ ...(await real<object>()), ...q }));
const svc = vi.hoisted(() => ({ createServiceClient: vi.fn(() => ({})) }));
vi.mock("@/lib/supabase/service", () => svc);

const { GET } = await import("@/app/api/cron/monthly-report/route");

const SECRET = "cron-secret-0123456789";
const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/monthly-report", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T15:05:00Z")); // Nov 1, 07:05 PST
  vi.stubEnv("CRON_SECRET", SECRET);
  q.enqueueMonthlyReports.mockReset().mockResolvedValue({ enqueued: 3, skipped: 1 });
  svc.createServiceClient.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/monthly-report", () => {
  it.each([undefined, "", "Bearer wrong", `bearer ${SECRET}`, SECRET, `Bearer ${SECRET}x`])(
    "401 for authorization %j, no DB",
    async (auth) => {
      expect((await call(auth)).status).toBe(401);
      expect(svc.createServiceClient).not.toHaveBeenCalled();
    },
  );

  it("in the window: enqueues last LA month, 200 with counts only", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ month: "2026-10-01", enqueued: 3, skipped: 1 });
    expect(q.enqueueMonthlyReports).toHaveBeenCalledWith({}, "2026-10-01");
  });

  it("the other UTC fire (06:05 PST) is a no-op without touching the DB", async () => {
    vi.setSystemTime(new Date("2026-11-01T14:05:00Z"));
    expect(await (await call(`Bearer ${SECRET}`)).json()).toEqual({ skipped: "outside_window" });
    expect(svc.createServiceClient).not.toHaveBeenCalled();
  });

  it("enqueue fails → 500 with a fixed label and no DB error text", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    q.enqueueMonthlyReports.mockRejectedValue(
      Object.assign(new Error("permission denied for reports"), { code: "42501" }),
    );
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe(JSON.stringify({ error: "enqueue_failed" }));
    expect(err.mock.calls.flat().join(" ")).not.toContain("permission denied");
  });
});
