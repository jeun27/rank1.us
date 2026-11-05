import { RESEND_URL } from "@/lib/email/resend";
import { REPORT_COPY, fill } from "./copy";
import type { ReportData } from "./data";

export type ReportEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  attachments: { filename: string; content: string }[];
};

// The business name can't break the From header: no <, >, quotes or line breaks.
const displayName = (name: string) =>
  name
    .replace(/[<>"\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// White-label: From = the business name at REPORT_FROM_EMAIL; subject/body from COPY.md only.
export function reportEmail(
  data: ReportData,
  opts: { fromAddress: string; to: string[]; pdf: Uint8Array; filename: string },
): ReportEmail {
  return {
    from: `${displayName(data.businessName)} <${opts.fromAddress}>`,
    to: opts.to,
    subject: fill(REPORT_COPY.subject, { Business: data.businessName, "Month YYYY": data.month }),
    text: fill(REPORT_COPY.body, { "Month YYYY": data.month, n: data.answers }),
    attachments: [{ filename: opts.filename, content: Buffer.from(opts.pdf).toString("base64") }],
  };
}

// One Resend send; true only on a 2xx. Idempotency-Key = report id, so a retry never double-sends.
// Never logs the payload, recipients or key.
export async function sendReportEmail(
  email: ReportEmail,
  idempotencyKey: string,
  deps: { fetch?: typeof fetch; apiKey?: string } = {},
): Promise<boolean> {
  const key = deps.apiKey ?? process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await (deps.fetch ?? fetch)(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(email),
    });
    return res.ok;
  } catch {
    return false;
  }
}
