import type { DbClient } from "./client";

// White-label monthly reports (Step 16). Buckets are private with no storage policies: the server
// checks access with the caller's client, then uploads or signs URLs with the service client.

export const REPORTS_BUCKET = "reports";
export const LOGOS_BUCKET = "logos";
export const LOGO_MAX_BYTES = 512 * 1024;
const SIGNED_URL_SECONDS = 60;

export type ReportStatus = "queued" | "rendering" | "generated" | "sent" | "failed";

export type ReportRow = {
  id: string;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  sent_at: string | null;
  // How many recipients the report went to (never the addresses).
  recipients: number;
  has_pdf: boolean;
};

// The business's reports, newest month first, through RLS (members; the team on DFY).
export async function listReports(db: DbClient, businessId: string): Promise<ReportRow[]> {
  const { data, error } = await db
    .from("reports")
    .select("id, period_start, period_end, status, sent_at, sent_to, pdf_path")
    .eq("business_id", businessId)
    .order("period_start", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    period_start: r.period_start,
    period_end: r.period_end,
    status: r.status as ReportStatus,
    sent_at: r.sent_at,
    recipients: r.sent_to.length,
    has_pdf: r.pdf_path !== null,
  }));
}

export type ReportSettings = { brand_color: string | null; report_recipients: string[]; has_logo: boolean };

export async function getReportSettings(db: DbClient, businessId: string): Promise<ReportSettings | null> {
  const { data, error } = await db
    .from("businesses")
    .select("brand_color, report_recipients, logo_path")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    brand_color: data.brand_color,
    report_recipients: data.report_recipients,
    has_logo: data.logo_path !== null,
  };
}

// Saves brand color and recipients with the caller's client (self-serve members, or the team on
// DFY). Emails are trimmed, lowercased and deduped. Errors: 23514 bad color or recipients
// (more than 10, or an invalid email), 42501/no rows when the caller can't change it.
export async function setReportSettings(
  db: DbClient,
  businessId: string,
  settings: { brand_color?: string | null; report_recipients?: string[] },
): Promise<void> {
  const patch: { brand_color?: string | null; report_recipients?: string[] } = {};
  if (settings.brand_color !== undefined) patch.brand_color = settings.brand_color;
  if (settings.report_recipients !== undefined) {
    patch.report_recipients = [
      ...new Set(settings.report_recipients.map((e) => e.trim().toLowerCase()).filter(Boolean)),
    ];
  }
  const { data, error } = await db.from("businesses").update(patch).eq("id", businessId).select("id");
  if (error) throw error;
  if (data.length === 0) throw Object.assign(new Error("Not allowed to change this business"), { code: "42501" });
}

const LOGO_TYPES: { type: "image/png" | "image/jpeg"; ext: string; magic: number[] }[] = [
  { type: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
];

export type LogoResult = { status: "saved"; path: string } | { status: "too_large" | "bad_type" | "not_allowed" };

// Server only. The caller's client proves they may change the business; the file is checked by
// its bytes (PNG or JPEG, ≤ 512 KB; SVG and anything else refused) and stored with the service client.
export async function uploadLogo(
  userDb: DbClient,
  serviceDb: DbClient,
  businessId: string,
  file: Uint8Array,
): Promise<LogoResult> {
  const { data: allowed, error } = await userDb.rpc("can_write_business", { p_business_id: businessId });
  if (error) throw error;
  if (!allowed) return { status: "not_allowed" };
  if (file.byteLength > LOGO_MAX_BYTES) return { status: "too_large" };
  const kind = LOGO_TYPES.find((t) => t.magic.every((b, i) => file[i] === b));
  if (!kind) return { status: "bad_type" };

  const path = `${businessId}/logo.${kind.ext}`;
  const upload = await serviceDb.storage
    .from(LOGOS_BUCKET)
    .upload(path, file, { contentType: kind.type, upsert: true });
  if (upload.error) throw upload.error;
  const { error: updateError } = await serviceDb.from("businesses").update({ logo_path: path }).eq("id", businessId);
  if (updateError) throw updateError;
  return { status: "saved", path };
}

// Server only. A 60 s signed URL for the business's logo, or null when the caller can't read it
// or there is no logo.
export async function getLogoUrl(userDb: DbClient, serviceDb: DbClient, businessId: string): Promise<string | null> {
  const { data, error } = await userDb.from("businesses").select("logo_path").eq("id", businessId).maybeSingle();
  if (error) throw error;
  if (!data?.logo_path) return null;
  const signed = await serviceDb.storage.from(LOGOS_BUCKET).createSignedUrl(data.logo_path, SIGNED_URL_SECONDS);
  if (signed.error) throw signed.error;
  return signed.data.signedUrl;
}

// Server only. A 60 s signed URL for a report PDF, or null when the caller can't read the report
// (RLS on their own client) or it has no PDF.
export async function getReportDownloadUrl(
  userDb: DbClient,
  serviceDb: DbClient,
  reportId: string,
): Promise<string | null> {
  const { data, error } = await userDb.from("reports").select("pdf_path").eq("id", reportId).maybeSingle();
  if (error) throw error;
  if (!data?.pdf_path) return null;
  const signed = await serviceDb.storage.from(REPORTS_BUCKET).createSignedUrl(data.pdf_path, SIGNED_URL_SECONDS);
  if (signed.error) throw signed.error;
  return signed.data.signedUrl;
}

// The 1st (YYYY-MM-DD) of the month before `now`'s month, in America/Los_Angeles.
export function laPreviousMonthStart(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
}

export type ClaimedReport = {
  report_id: string;
  business_id: string;
  period_start: string;
  period_end: string;
  attempt: number;
};

// Service client only. Queues last month's reports for eligible businesses. Idempotent.
// 22023 when month isn't laPreviousMonthStart(now).
export async function enqueueMonthlyReports(
  serviceDb: DbClient,
  month: string,
): Promise<{ enqueued: number; skipped: number }> {
  const { data, error } = await serviceDb.rpc("enqueue_monthly_reports", { p_month: month });
  if (error) throw error;
  return data as unknown as { enqueued: number; skipped: number };
}

// Service client only. Claims up to `limit` reports to render (the drain uses 2 per tick).
export async function claimReports(serviceDb: DbClient, limit: number): Promise<ClaimedReport[]> {
  const { data, error } = await serviceDb.rpc("claim_reports", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as unknown as ClaimedReport[];
}

// Service client only. generated = stored with no recipients; sent = emailed to sentTo; failed =
// keep `error` internal (never shown to customers). Returns false when the report wasn't rendering.
export async function finishReport(
  serviceDb: DbClient,
  report: {
    reportId: string;
    status: "generated" | "sent" | "failed";
    pdfPath: string | null;
    sentTo: string[];
    error?: string;
  },
): Promise<boolean> {
  const { data, error } = await serviceDb.rpc("finish_report", {
    p_report_id: report.reportId,
    p_status: report.status,
    p_pdf_path: report.pdfPath,
    p_sent_to: report.sentTo,
    p_error: report.error ?? null,
  });
  if (error) throw error;
  return data;
}
