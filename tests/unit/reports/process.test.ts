import { describe, expect, it, vi } from "vitest";
import { monthRuns, type ReportInput, type ReportRun } from "@/lib/reports/data";
import {
  MIN_TIME_LEFT_MS,
  processReports,
  reportFilename,
  runMonthly,
  type ClaimedReport,
  type ReportDeps,
} from "@/lib/reports/process";

const report = (i: number): ClaimedReport => ({
  report_id: `rep-${i}`,
  business_id: `biz-${i}`,
  period_start: "2026-10-01",
  period_end: "2026-10-31",
});
const input: ReportInput = {
  business: { name: "Example Ramen House", brand_color: "#0B6E4F" },
  logo: null,
  periodStart: "2026-10-01",
  runs: [],
  last: null,
  previous: null,
  fixes: [],
};
const PDF = new Uint8Array([1, 2, 3]);

const base = () => ({
  claim: vi.fn<ReportDeps["claim"]>().mockResolvedValue([]),
  load: vi.fn<ReportDeps["load"]>().mockResolvedValue({ input, recipients: ["owner@example.com"] }),
  render: vi.fn<ReportDeps["render"]>().mockResolvedValue(PDF),
  upload: vi.fn<ReportDeps["upload"]>().mockResolvedValue(undefined),
  send: vi.fn<ReportDeps["send"]>().mockResolvedValue(true),
  finish: vi.fn<ReportDeps["finish"]>().mockResolvedValue(true),
  timeLeftMs: vi.fn<ReportDeps["timeLeftMs"]>().mockReturnValue(200_000),
  log: vi.fn<(l: string) => void>(),
});
const deps = (p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...p });
const queue = (...items: ClaimedReport[]) => vi.fn<ReportDeps["claim"]>(async () => items.splice(0, 1));

describe("processReports (the run-jobs drain hook)", () => {
  it("renders, stores, sends with the report id as the idempotency key, and finishes as sent", async () => {
    const d = deps({ claim: queue(report(1)) });
    expect(await processReports(d)).toEqual({ sent: 1, generated: 0, retry: 0 });
    expect(d.upload).toHaveBeenCalledWith("biz-1/rep-1.pdf", PDF);
    expect(d.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["owner@example.com"], pdf: PDF, filename: "ai-visibility-report-2026-10.pdf" }),
      "rep-1",
    );
    expect(d.send.mock.calls[0][0].data.businessName).toBe("Example Ramen House");
    expect(d.finish).toHaveBeenCalledWith({
      reportId: "rep-1",
      status: "sent",
      pdfPath: "biz-1/rep-1.pdf",
      sentTo: ["owner@example.com"],
    });
  });

  it("no recipients → generated and stored, nothing sent", async () => {
    const d = deps({ claim: queue(report(1)), load: vi.fn().mockResolvedValue({ input, recipients: [] }) });
    expect(await processReports(d)).toEqual({ sent: 0, generated: 1, retry: 0 });
    expect(d.send).not.toHaveBeenCalled();
    expect(d.finish).toHaveBeenCalledWith(expect.objectContaining({ status: "generated", sentTo: [] }));
  });

  it("at most 2 per tick, claimed one at a time", async () => {
    const d = deps({ claim: queue(report(1), report(2), report(3)) });
    expect(await processReports(d)).toEqual({ sent: 2, generated: 0, retry: 0 });
    expect(d.claim.mock.calls).toEqual([[1], [1]]);
  });

  it("never claims with under 60 s left, before the first report or the second", async () => {
    const none = deps({ claim: queue(report(1)), timeLeftMs: vi.fn().mockReturnValue(MIN_TIME_LEFT_MS - 1) });
    expect(await processReports(none)).toEqual({ sent: 0, generated: 0, retry: 0, skipped: "time" });
    expect(none.claim).not.toHaveBeenCalled();

    const one = deps({
      claim: queue(report(1), report(2)),
      timeLeftMs: vi.fn().mockReturnValueOnce(120_000).mockReturnValue(59_000),
    });
    expect(await processReports(one)).toEqual({ sent: 1, generated: 0, retry: 0 });
    expect(one.claim).toHaveBeenCalledTimes(1);
  });

  it.each(["load", "render", "upload"] as const)(
    "a %s error leaves that report for claim_reports to retry; the next one still goes",
    async (step) => {
      const d = deps({ claim: queue(report(1), report(2)) });
      d[step].mockRejectedValueOnce(
        Object.assign(new Error("Example Ramen House owner@example.com"), { code: "XX000" }),
      );
      expect(await processReports(d)).toEqual({ sent: 1, generated: 0, retry: 1 });
      expect(d.finish).toHaveBeenCalledTimes(1);
      expect(d.finish.mock.calls[0][0].reportId).toBe("rep-2");
    },
  );

  it("a failed send is not marked sent; it retries (Resend dedupes by the report id)", async () => {
    const d = deps({ claim: queue(report(1)), send: vi.fn().mockResolvedValue(false) });
    expect(await processReports(d)).toEqual({ sent: 0, generated: 0, retry: 1 });
    expect(d.finish).not.toHaveBeenCalled();
  });

  it("a claim error stops the tick without throwing", async () => {
    const d = deps({ claim: vi.fn().mockRejectedValue(Object.assign(new Error("boom"), { code: "57014" })) });
    expect(await processReports(d)).toEqual({ sent: 0, generated: 0, retry: 0, skipped: "claim_failed" });
    expect(d.log).toHaveBeenCalledWith("reports: claim failed (57014)");
  });

  it("logs carry counts and codes only: no business name, email, id or error text", async () => {
    const d = deps({ claim: queue(report(1), report(2)) });
    d.render.mockRejectedValueOnce(
      Object.assign(new Error("Example Ramen House owner@example.com"), { code: "XX000" }),
    );
    await processReports(d);
    const logged = d.log.mock.calls.map((c) => c[0]).join("\n");
    expect(logged).toBe("reports: one report will retry (XX000)\nreports: sent=1 generated=0 retry=1");
    for (const bad of ["Example", "@", "rep-", "biz-", "boom"]) expect(logged).not.toContain(bad);
  });

  it("an empty queue logs nothing", async () => {
    const d = deps();
    expect(await processReports(d)).toEqual({ sent: 0, generated: 0, retry: 0 });
    expect(d.log).not.toHaveBeenCalled();
  });

  it("the attachment name carries the month only", () => {
    expect(reportFilename("2026-10-01")).toBe("ai-visibility-report-2026-10.pdf");
  });
});

describe("monthRuns", () => {
  const run = (id: string, started_at: string | null): ReportRun => ({
    id,
    status: "complete",
    started_at,
    finished_at: null,
    visibility: { value: 0.5, numerator: 1, denominator: 2 },
  });

  it("keeps the month's runs by Los Angeles date (inclusive) and finds the run before it", () => {
    const summaries = [
      run("nov", "2026-11-01T08:00:00Z"), // Nov 1, 01:00 PDT
      run("oct-last", "2026-11-01T06:30:00Z"), // Oct 31, 23:30 PDT
      run("oct-mid", "2026-10-12T13:00:00Z"),
      run("oct-first", "2026-10-01T07:30:00Z"), // Oct 1, 00:30 PDT
      run("sep", "2026-10-01T06:30:00Z"), // Sep 30, 23:30 PDT
      run("aug", "2026-08-30T13:00:00Z"),
    ];
    const { runs, previous } = monthRuns(summaries, "2026-10-01", "2026-10-31");
    expect(runs.map((r) => r.id)).toEqual(["oct-last", "oct-mid", "oct-first"]);
    expect(previous?.id).toBe("sep");
  });

  it("an empty month has no runs, and no previous run is null", () => {
    expect(monthRuns([run("nov", "2026-11-03T13:00:00Z")], "2026-10-01", "2026-10-31")).toEqual({
      runs: [],
      previous: null,
    });
  });
});

describe("runMonthly (the monthly cron)", () => {
  const monthly = (now: string, enqueue = vi.fn().mockResolvedValue({ enqueued: 3, skipped: 1 })) => {
    const log = vi.fn();
    const previousMonth = vi.fn(() => "2026-10-01");
    return {
      log,
      enqueue,
      previousMonth,
      run: () => runMonthly({ enqueue, previousMonth, log, now: () => new Date(now) }),
    };
  };

  it("outside the 1st at 07:xx LA: a no-op", async () => {
    const m = monthly("2026-11-01T14:05:00Z"); // 06:05 PST
    expect(await m.run()).toEqual({ status: 200, body: { skipped: "outside_window" } });
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("in the window: enqueues last month and returns counts only", async () => {
    const m = monthly("2026-11-01T15:05:00Z"); // 07:05 PST
    expect(await m.run()).toEqual({ status: 200, body: { month: "2026-10-01", enqueued: 3, skipped: 1 } });
    expect(m.enqueue).toHaveBeenCalledWith("2026-10-01");
    expect(m.log).toHaveBeenCalledWith("monthly 2026-10-01: enqueued=3 skipped=1");
  });

  it("an enqueue error → 500 with a fixed label; only the code is logged", async () => {
    const m = monthly(
      "2026-11-01T15:05:00Z",
      vi.fn().mockRejectedValue(Object.assign(new Error("relation reports secret detail"), { code: "42P01" })),
    );
    expect(await m.run()).toEqual({ status: 500, body: { error: "enqueue_failed" } });
    expect(m.log).toHaveBeenCalledWith("monthly 2026-10-01: enqueue_error=42P01");
  });
});
