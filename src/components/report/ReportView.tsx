"use client";
import { useId, useState, type ReactNode } from "react";
import { Page, Section } from "@/components/app/Page";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Table } from "@/components/ui/Table";
import type { ReportRow, ReportStatus } from "@/lib/queries/reports";
import { monthLabel, shortDate } from "@/lib/reports/month";
import { reportCopy as c } from "./copy";

type Result = Promise<{ error: string } | undefined | void>;
export type ReportActions = {
  save: (s: { brand_color: string; report_recipients: string[] }) => Result;
  uploadLogo: (form: FormData) => Result;
  sendTest: () => Promise<{ status: "sent"; email: string } | { status: "failed" | "not_allowed" }>;
};
export type ReportSettingsView = { brand_color: string | null; report_recipients: string[]; logoUrl: string | null };

const MAX_RECIPIENTS = 10;
const LOGO_MAX_BYTES = 512 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_COLOR = "#1D5FC5";
const TONE: Record<ReportStatus, "info" | "success" | "warn" | "error"> = {
  queued: "info",
  rendering: "info",
  generated: "info",
  sent: "success",
  failed: "error",
};
const field =
  "rounded-card border border-fieldBorder bg-white px-4 py-3 text-ui focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";

// Blank lines dropped, lowercased, de-duplicated. null when any line isn't an email or there are too many.
function parseRecipients(text: string): string[] | null {
  const list = [
    ...new Set(
      text
        .split("\n")
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  return list.length <= MAX_RECIPIENTS && list.every((e) => EMAIL.test(e)) ? list : null;
}

// X10: a folded section below the work. The summary reads like a section title, 44px tall below md.
function Fold({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details className="group" open={open} onToggle={(e) => onToggle?.(e.currentTarget.open)}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-display text-section font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep">
        {title}
        <Icon
          name="chevronRight"
          className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

// UI.md 4b "Report": the white-label monthly PDF's history, preview and settings. X10: the next send and
// the history lead, the preview and Branding fold below them. X28: Save lights up only when something
// changed, and the test send shows once recipients are saved.
export function ReportView({
  settings,
  reports,
  previewSrc,
  nextReport,
  actions,
  connectGa4Href = null,
}: {
  settings: ReportSettingsView;
  reports: ReportRow[];
  previewSrc: string;
  // The next send's day ("2026-12-01"), from nextReportDate.
  nextReport: string;
  actions: ReportActions;
  // The Connections hub, when it exists. GA4 isn't connected, so the GA4 section stays hidden either way.
  connectGa4Href?: string | null;
}) {
  const ids = { logo: useId(), color: useId(), recipients: useId(), hint: useId() };
  const [saved, setSaved] = useState({
    color: (settings.brand_color ?? DEFAULT_COLOR).toLowerCase(),
    recipients: settings.report_recipients,
  });
  const [color, setColor] = useState(saved.color);
  const [recipients, setRecipients] = useState(saved.recipients.join("\n"));
  const dirty = color !== saved.color || recipients.trim() !== saved.recipients.join("\n");
  // Opened once, so the server renders the real PDF only when someone asks for it.
  const [previewShown, setPreviewShown] = useState(false);
  // Branding starts open while there's no one to send to (the status line asks for a recipient).
  const [brandingOpen] = useState(saved.recipients.length === 0);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const failed = reports[0]?.status === "failed";

  return (
    <Page title={c.title}>
      {failed && settings.report_recipients.length > 0 && (
        <Banner tone="error">{c.failed(settings.report_recipients.join(", "))}</Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <p data-computed className="text-body-lg">
        {c.next(shortDate(nextReport), saved.recipients.length)}
      </p>
      {connectGa4Href && (
        <a
          href={connectGa4Href}
          className="inline-flex min-h-11 items-center self-start text-ui text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
        >
          {c.connectGa4}
        </a>
      )}

      {reports.length > 0 ? (
        <Section title={c.history}>
          <Table
            caption={c.history}
            columns={[
              { key: "m", header: c.month },
              { key: "s", header: c.status },
              { key: "d", header: c.download },
            ]}
            rows={reports.map((r) => ({
              m: <span data-computed>{monthLabel(r.period_start)}</span>,
              s: <Badge tone={TONE[r.status]}>{c.statuses[r.status]}</Badge>,
              d: r.has_pdf ? (
                <a
                  href={`/app/report/${r.id}/download`}
                  aria-label={`${c.download} ${monthLabel(r.period_start)}`}
                  className="inline-flex min-h-11 items-center text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
                >
                  {c.download}
                </a>
              ) : (
                "–"
              ),
            }))}
          />
        </Section>
      ) : (
        <p className="text-body-lg">{c.empty}</p>
      )}

      <Fold title={c.preview} onToggle={(open) => open && setPreviewShown(true)}>
        {previewShown && (
          <iframe
            title={c.preview}
            src={previewSrc}
            className="aspect-[1/1.414] w-full rounded-card border border-border bg-white"
          />
        )}
      </Fold>

      <Fold title={c.branding} open={brandingOpen}>
        <Card>
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setStatus("");
              setError(null);
              const list = parseRecipients(recipients);
              setRecipientsError(list ? null : c.recipientsError);
              if (!list) return;
              const r = await actions
                .save({ brand_color: color.toUpperCase(), report_recipients: list })
                .catch(() => ({ error: "failed" }));
              if (r && "error" in r) return setError(c.saveFailed);
              setSaved({ color, recipients: list });
              setRecipients(list.join("\n"));
              setStatus(c.saved);
            }}
          >
            <div className="flex flex-col gap-2">
              <span className="text-caption font-semibold">{c.logo}</span>
              {settings.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL, not optimizable
                <img src={settings.logoUrl} alt="" className="h-12 w-auto self-start object-contain" />
              )}
              <label htmlFor={ids.logo} className="text-ui">
                {c.uploadLogo}
              </label>
              <input
                id={ids.logo}
                type="file"
                accept="image/png,image/jpeg"
                aria-invalid={logoError ? "true" : undefined}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setStatus("");
                  setError(null);
                  if (!LOGO_TYPES.includes(file.type)) return setLogoError(c.logoType);
                  if (file.size > LOGO_MAX_BYTES) return setLogoError(c.logoSize);
                  setLogoError(null);
                  const form = new FormData();
                  form.set("logo", file);
                  const r = await actions.uploadLogo(form).catch(() => ({ error: "failed" }));
                  if (r && "error" in r)
                    return r.error === "too_large"
                      ? setLogoError(c.logoSize)
                      : r.error === "bad_type"
                        ? setLogoError(c.logoType)
                        : setError(c.saveFailed);
                  setStatus(c.saved);
                }}
                className="text-ui file:mr-3 file:min-h-11 file:rounded-full file:border file:border-fieldBorder file:bg-white file:px-4 file:font-semibold"
              />
              {logoError && <p className="text-caption text-brick">{logoError}</p>}
            </div>

            <div className="flex items-center gap-3">
              <input
                id={ids.color}
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-11 cursor-pointer rounded-card border border-fieldBorder bg-white p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
              />
              <label htmlFor={ids.color} className="text-ui">
                {c.brandColor}
              </label>
              <span data-computed className="text-caption text-inkMuted tabular-nums">
                {color.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.recipients} className="text-caption font-semibold">
                {c.recipients}
              </label>
              <textarea
                id={ids.recipients}
                rows={4}
                value={recipients}
                aria-describedby={ids.hint}
                aria-invalid={recipientsError ? "true" : undefined}
                onChange={(e) => setRecipients(e.target.value)}
                className={field}
              />
              <p id={ids.hint} className={`text-caption ${recipientsError ? "text-brick" : "text-inkMuted"}`}>
                {recipientsError ?? c.recipientsHint}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" variant={dirty ? "primary" : "alt"}>
                {c.save}
              </Button>
              {saved.recipients.length > 0 && (
                <button
                  type="button"
                  disabled={sending}
                  onClick={async () => {
                    setSending(true);
                    setStatus("");
                    setError(null);
                    const r = await actions.sendTest().catch(() => ({ status: "failed" as const }));
                    setSending(false);
                    if (r.status === "sent") setStatus(c.testSent(r.email));
                    else setError(c.sendFailed);
                  }}
                  className="inline-flex min-h-11 items-center rounded-full border border-fieldBorder bg-white px-5 text-ui font-semibold hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
                >
                  {c.sendTest}
                </button>
              )}
              <p role="status" data-computed className="text-caption text-inkMuted">
                {status}
              </p>
            </div>
          </form>
        </Card>
      </Fold>
    </Page>
  );
}
