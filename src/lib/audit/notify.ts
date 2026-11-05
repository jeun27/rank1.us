import type { Email } from "@/lib/email/resend";
import { computeMetrics, type MetricAnswer } from "@/lib/metrics";

export const MAX_NOTIFY_ATTEMPTS = 5;

export type UnnotifiedFreeAudit = {
  run_id: string;
  lead_id: string;
  token: string;
  domain: string;
  email: string;
  run_status: "complete" | "partial" | "failed";
};

export type NotifyDeps = {
  listUnnotified: () => Promise<UnnotifiedFreeAudit[]>;
  answers: (runId: string) => Promise<MetricAnswer[]>;
  send: (email: Email, idempotencyKey: string) => Promise<boolean>;
  markNotified: (runId: string, sent: boolean) => Promise<void>;
  bumpAttempts: (runId: string) => Promise<void>;
  env?: Record<string, string | undefined>;
  log?: (line: string) => void;
};

export type NotifySummary = { sent: number; failedRuns: number; sendErrors: number; skipped: boolean };

// Strings from docs/COPY.md "Audit email (lead, 2026-11-05)".
export function auditEmail(a: UnnotifiedFreeAudit, n: number, siteUrl: string, from: string): Email {
  const link = `${siteUrl.replace(/\/+$/, "")}/audit/${a.token}`;
  return {
    from,
    to: a.email,
    reply_to: from,
    subject: "Your Rank1 audit is ready",
    text: `Your free audit for ${a.domain} is ready: ${link}\n\nAPI-measured, directional. Results are based on ${n} AI answers.`,
  };
}

// After each drain: one email per finished free audit (complete or partial), idempotent per lead.
// Failed runs are marked handled without an email. Log lines never carry an email, token or domain.
export async function notifyFreeAudits(deps: NotifyDeps): Promise<NotifySummary> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((l: string) => console.error(l));
  const out: NotifySummary = { sent: 0, failedRuns: 0, sendErrors: 0, skipped: false };
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const from = env.CONTACT_FROM_EMAIL;
  if (!siteUrl || !from) {
    log("free audit notify: skipped (NEXT_PUBLIC_SITE_URL or CONTACT_FROM_EMAIL unset)");
    return { ...out, skipped: true };
  }
  for (const a of await deps.listUnnotified()) {
    try {
      if (a.run_status === "failed") {
        await deps.markNotified(a.run_id, false);
        log(`free audit notify: run ${a.run_id} failed, not emailed`);
        out.failedRuns++;
        continue;
      }
      const n = computeMetrics({ answers: await deps.answers(a.run_id), citations: [], brands: [], freeAudit: true })
        .visibility.denominator;
      if (await deps.send(auditEmail(a, n, siteUrl, from), a.lead_id)) {
        await deps.markNotified(a.run_id, true);
        out.sent++;
      } else {
        await deps.bumpAttempts(a.run_id);
        log(`free audit notify: run ${a.run_id} send failed`);
        out.sendErrors++;
      }
    } catch {
      log(`free audit notify: run ${a.run_id} error`);
      out.sendErrors++;
    }
  }
  return out;
}
