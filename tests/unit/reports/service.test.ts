import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const q = vi.hoisted(() => ({
  listRunSummaries: vi.fn(),
  listFixes: vi.fn(),
  getRunResults: vi.fn(),
}));
vi.mock("@/lib/queries/shell", () => ({ listRunSummaries: q.listRunSummaries }));
vi.mock("@/lib/queries/fixes", () => ({ listFixes: q.listFixes }));
vi.mock("@/lib/queries/results", () => ({ getRunResults: q.getRunResults }));
vi.mock("@/lib/reports/document", () => ({ renderReportPdf: async () => new Uint8Array([37, 80, 68, 70]) }));

const { sendTestReport } = await import("@/lib/reports/service");

const BUSINESS = {
  name: "Example Ramen House",
  brand_color: null,
  logo_path: null,
  report_recipients: ["owner@example.com", "manager@example.com"],
};
const userDb = (email: string | null, business: typeof BUSINESS | null = BUSINESS) =>
  ({
    auth: { getUser: async () => ({ data: { user: email ? { id: "user-1", email } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: business, error: null }) }) }) }),
  }) as never;
const serviceDb = {} as never;
const fetchMock = vi.fn();
const NOW = new Date("2026-11-05T18:00:00Z");

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_example_only");
  vi.stubEnv("REPORT_FROM_EMAIL", "hello@example.com");
  vi.stubGlobal("fetch", fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 })));
  q.listRunSummaries.mockReset().mockResolvedValue([]);
  q.listFixes.mockReset().mockResolvedValue({ ranked: [], tidyUps: [], unchecked: [], lastRunId: null });
  q.getRunResults.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendTestReport ('Send test to me')", () => {
  it("sends last month's report to the signed-in user's own email only, never the recipients", async () => {
    expect(await sendTestReport(userDb("Me@Example.com"), serviceDb, "biz-1", NOW)).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["me@example.com"]);
    expect(body.from).toBe("Example Ramen House <hello@example.com>");
    expect(body.subject).toBe("Example Ramen House AI visibility report, October 2026");
    expect(body.attachments[0].filename).toBe("ai-visibility-report-2026-10.pdf");
    expect(init.headers["idempotency-key"]).toBe(`test-biz-1-user-1-${Math.floor(NOW.getTime() / 60_000)}`);
  });

  it("signed out, or a business the caller can't read (RLS) → not_allowed, nothing sent", async () => {
    expect(await sendTestReport(userDb(null), serviceDb, "biz-1", NOW)).toBe("not_allowed");
    expect(await sendTestReport(userDb("me@example.com", null), serviceDb, "biz-1", NOW)).toBe("not_allowed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a Resend error or a missing REPORT_FROM_EMAIL → failed", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect(await sendTestReport(userDb("me@example.com"), serviceDb, "biz-1", NOW)).toBe("failed");
    vi.stubEnv("REPORT_FROM_EMAIL", "");
    expect(await sendTestReport(userDb("me@example.com"), serviceDb, "biz-1", NOW)).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
