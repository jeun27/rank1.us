import type { ReportStatus } from "@/lib/queries/reports";

// docs/COPY.md "Report (lead, 2026-11-05)" and UI.md 4b "Report".
export const reportCopy = {
  title: "Reports",
  // COPY.md "UX (lead, 2026-11-06)" X10.
  next: (date: string, n: number) =>
    n === 0
      ? `Next report ${date}. Add a recipient to send it.`
      : `Next report ${date} to ${n} ${n === 1 ? "recipient" : "recipients"}.`,
  branding: "Branding",
  empty: "Your first report sends on the 1st.",
  failed: (emails: string) => `The report didn't send to ${emails}. Check the address.`,
  preview: "Report preview",
  connectGa4: "Connect GA4",
  logo: "Logo",
  uploadLogo: "Upload logo",
  brandColor: "Brand color",
  recipients: "Recipients",
  recipientsHint: "Up to 10 emails, one per line.",
  recipientsError: "Add up to 10 valid emails, one per line.",
  save: "Save",
  saved: "Saved.",
  sendTest: "Send test to me",
  testSent: (email: string) => `Test sent to ${email}.`,
  sendFailed: "That didn't send. Try again in a minute.",
  logoType: "Use a PNG or JPEG.",
  logoSize: "Logos can be up to 512 KB.",
  saveFailed: "We couldn't save that. Try again.",
  history: "History",
  month: "Month",
  status: "Status",
  download: "Download",
  statuses: {
    queued: "Queued",
    rendering: "Building",
    generated: "Ready",
    sent: "Sent",
    failed: "Failed",
  } satisfies Record<ReportStatus, string>,
};
