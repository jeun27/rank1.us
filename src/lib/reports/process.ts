import { buildReportData, type ReportData, type ReportInput } from "./data";
import { isMonthlyWindow } from "./month";

// The run-jobs drain renders at most 2 reports per tick, and only with ≥60 s of maxDuration left (lead).
export const REPORTS_PER_TICK = 2;
export const MIN_TIME_LEFT_MS = 60_000;

export type ClaimedReport = { report_id: string; business_id: string; period_start: string; period_end: string };
export type ReportDeps = {
  claim: (limit: number) => Promise<ClaimedReport[]>;
  // Stored data for the business and month, plus report_recipients (validated by the DB, max 10).
  load: (report: ClaimedReport) => Promise<{ input: ReportInput; recipients: string[] }>;
  render: (data: ReportData) => Promise<Uint8Array>;
  upload: (path: string, pdf: Uint8Array) => Promise<void>;
  // Resend with Idempotency-Key = report id; true only on a 2xx.
  send: (
    m: { data: ReportData; to: string[]; pdf: Uint8Array; filename: string },
    idempotencyKey: string,
  ) => Promise<boolean>;
  finish: (r: {
    reportId: string;
    status: "generated" | "sent";
    pdfPath: string;
    sentTo: string[];
  }) => Promise<boolean>;
  timeLeftMs: () => number;
  log?: (line: string) => void;
};

export type ReportsSummary = { sent: number; generated: number; retry: number; skipped?: "time" | "claim_failed" };

const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");

export const reportFilename = (periodStart: string) => `ai-visibility-report-${periodStart.slice(0, 7)}.pdf`;

// Each report on its own: an error leaves it 'rendering', and claim_reports retries it after 10 minutes
// (3 attempts, then failed), so a Resend or Storage hiccup never loses a month. Never throws. Logs carry
// counts and error codes only, never names, emails or DB error text.
export async function processReports(deps: ReportDeps): Promise<ReportsSummary> {
  const log = deps.log ?? ((l: string) => console.error(l));
  const out: ReportsSummary = { sent: 0, generated: 0, retry: 0 };
  // One claim at a time, so a report is never claimed without the time to finish it.
  for (let i = 0; i < REPORTS_PER_TICK; i++) {
    if (deps.timeLeftMs() < MIN_TIME_LEFT_MS) {
      if (i === 0) out.skipped = "time";
      break;
    }
    let report: ClaimedReport | undefined;
    try {
      report = (await deps.claim(1))[0];
    } catch (e) {
      log(`reports: claim failed (${codeOf(e)})`);
      out.skipped = "claim_failed";
      break;
    }
    if (!report) break;
    try {
      const { input, recipients } = await deps.load(report);
      const data = buildReportData(input);
      const pdf = await deps.render(data);
      const pdfPath = `${report.business_id}/${report.report_id}.pdf`;
      await deps.upload(pdfPath, pdf);
      if (
        recipients.length &&
        !(await deps.send(
          { data, to: recipients, pdf, filename: reportFilename(report.period_start) },
          report.report_id,
        ))
      )
        throw Object.assign(new Error("send failed"), { code: "send" });
      const status = recipients.length ? "sent" : "generated";
      await deps.finish({ reportId: report.report_id, status, pdfPath, sentTo: recipients });
      out[status]++;
    } catch (e) {
      log(`reports: one report will retry (${codeOf(e)})`);
      out.retry++;
    }
  }
  if (out.sent + out.generated + out.retry)
    log(`reports: sent=${out.sent} generated=${out.generated} retry=${out.retry}`);
  return out;
}

export type MonthlyDeps = {
  enqueue: (month: string) => Promise<{ enqueued: number; skipped: number }>;
  previousMonth: (now: Date) => string;
  now?: () => Date;
  log?: (line: string) => void;
};

export type MonthlyOutcome =
  | { status: 200; body: { skipped: "outside_window" } }
  | { status: 200; body: { month: string; enqueued: number; skipped: number } }
  | { status: 500; body: { error: "enqueue_failed" } };

// The monthly cron only enqueues last month's reports (the run-jobs drain renders and sends them).
export async function runMonthly(deps: MonthlyDeps): Promise<MonthlyOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const log = deps.log ?? ((l: string) => console.error(l));
  if (!isMonthlyWindow(now)) return { status: 200, body: { skipped: "outside_window" } };
  const month = deps.previousMonth(now);
  try {
    const r = await deps.enqueue(month);
    log(`monthly ${month}: enqueued=${r.enqueued} skipped=${r.skipped}`);
    return { status: 200, body: { month, enqueued: r.enqueued, skipped: r.skipped } };
  } catch (e) {
    log(`monthly ${month}: enqueue_error=${codeOf(e)}`);
    return { status: 500, body: { error: "enqueue_failed" } };
  }
}
