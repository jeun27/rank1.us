import "server-only";
import type { MetricCitation } from "@/lib/metrics";
import type { DbClient } from "@/lib/queries/client";
import { listFixes } from "@/lib/queries/fixes";
import { claimReports, finishReport, laPreviousMonthStart, LOGOS_BUCKET, REPORTS_BUCKET } from "@/lib/queries/reports";
import { getRunResults } from "@/lib/queries/results";
import { listRunSummaries } from "@/lib/queries/shell";
import { buildReportData, monthRuns, type ReportData, type ReportInput } from "./data";
import { renderReportPdf } from "./document";
import { reportEmail, sendReportEmail } from "./email";
import { processReports, reportFilename } from "./process";

// Enough summaries to cover a month of weekly checks and audits plus the run before it.
const SUMMARIES = 20;

const lastDay = (periodStart: string) => {
  const d = new Date(`${periodStart}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

// Stored data only, read with `db` (the service client in the drain, the caller's client for a test send).
// The logo comes from the private bucket with the service client; a missing file falls back to the name.
async function loadReport(
  db: DbClient,
  serviceDb: DbClient,
  businessId: string,
  periodStart: string,
  periodEnd: string,
) {
  const { data: business, error } = await db
    .from("businesses")
    .select("name, brand_color, logo_path, report_recipients, service, fix_list_visible")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!business) return null;
  // A DFY client sees fixes only when the team shows them (fix_list_visible). The service client bypasses
  // that RLS rule, so apply it here: hidden → no fixes, and the PDF omits the whole section (review of #77).
  const showFixes = business.service !== "dfy" || business.fix_list_visible;
  const [summaries, fixes, logo] = await Promise.all([
    listRunSummaries(db, businessId, SUMMARIES, ["complete", "partial"]),
    showFixes ? listFixes(db, businessId) : null,
    business.logo_path ? loadLogo(serviceDb, business.logo_path) : null,
  ]);
  const { runs, previous } = monthRuns(summaries, periodStart, periodEnd);
  const results = runs[0] ? await getRunResults(db, runs[0].id) : null;
  const input: ReportInput = {
    business: { name: business.name, brand_color: business.brand_color },
    logo,
    periodStart,
    runs,
    last: results && {
      answers: results.answers,
      citations: results.citations as MetricCitation[],
      brands: results.brands,
    },
    previous,
    fixes: fixes ? [...fixes.ranked, ...fixes.tidyUps].map(({ title, detail }) => ({ title, detail })) : [],
  };
  return { input, recipients: business.report_recipients };
}

async function loadLogo(serviceDb: DbClient, path: string): Promise<ReportInput["logo"]> {
  const { data, error } = await serviceDb.storage.from(LOGOS_BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), type: path.endsWith(".png") ? "image/png" : "image/jpeg" };
}

// From = the business name at REPORT_FROM_EMAIL; false (retry) while it's unset.
const send = (m: { data: ReportData; to: string[]; pdf: Uint8Array; filename: string }, key: string) => {
  const fromAddress = process.env.REPORT_FROM_EMAIL;
  if (!fromAddress) return Promise.resolve(false);
  return sendReportEmail(reportEmail(m.data, { fromAddress, ...m }), key);
};

// The run-jobs drain hook, on the service client.
export function processReportsWith(serviceDb: DbClient, timeLeftMs: () => number) {
  return processReports({
    claim: (limit) => claimReports(serviceDb, limit),
    async load(r) {
      const loaded = await loadReport(serviceDb, serviceDb, r.business_id, r.period_start, r.period_end);
      if (!loaded) throw Object.assign(new Error("business not found"), { code: "no_business" });
      return loaded;
    },
    render: renderReportPdf,
    async upload(path, pdf) {
      const { error } = await serviceDb.storage
        .from(REPORTS_BUCKET)
        .upload(path, pdf, { contentType: "application/pdf", upsert: true });
      if (error) throw error;
    },
    send,
    finish: (f) => finishReport(serviceDb, f),
    timeLeftMs,
  });
}

// Last month's report for the business, read with the caller's client (RLS decides access), never stored.
// Null when the caller can't read the business.
async function renderLastMonth(userDb: DbClient, serviceDb: DbClient, businessId: string, now: Date) {
  const periodStart = laPreviousMonthStart(now);
  const loaded = await loadReport(userDb, serviceDb, businessId, periodStart, lastDay(periodStart));
  if (!loaded) return null;
  const data = buildReportData(loaded.input);
  return { data, pdf: await renderReportPdf(data), periodStart };
}

// The /app/report Preview: the same PDF the business would get, rendered on demand. Never sends or stores.
export async function renderReportPreview(
  userDb: DbClient,
  serviceDb: DbClient,
  businessId: string,
  now: Date = new Date(),
): Promise<Uint8Array | null> {
  return (await renderLastMonth(userDb, serviceDb, businessId, now))?.pdf ?? null;
}

export type TestSendResult = "sent" | "not_allowed" | "failed";

// 'Send test to me': last month's report to the signed-in user's own email only, never stored.
// The key dedupes double clicks within a minute.
export async function sendTestReport(
  userDb: DbClient,
  serviceDb: DbClient,
  businessId: string,
  now: Date = new Date(),
): Promise<TestSendResult> {
  const { data: auth } = await userDb.auth.getUser();
  if (!auth.user?.email) return "not_allowed";
  try {
    const report = await renderLastMonth(userDb, serviceDb, businessId, now);
    if (!report) return "not_allowed";
    const key = `test-${businessId}-${auth.user.id}-${Math.floor(now.getTime() / 60_000)}`;
    const to = [auth.user.email.toLowerCase()];
    const ok = await send(
      { data: report.data, to, pdf: report.pdf, filename: reportFilename(report.periodStart) },
      key,
    );
    return ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
