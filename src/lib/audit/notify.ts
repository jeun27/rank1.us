import type { Email } from "@/lib/email/resend";
import type { UnnotifiedFreeAudit } from "@/lib/queries/results";

export type { UnnotifiedFreeAudit };

export type NotifyDeps = {
  listUnnotified: () => Promise<UnnotifiedFreeAudit[]>;
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
      if (a.status === "failed") {
        await deps.markNotified(a.runId, false);
        log(`free audit notify: run ${a.runId} failed, not emailed`);
        out.failedRuns++;
        continue;
      }
      // okAnswers = status 'ok' answers: the visibility denominator for a free audit.
      const n = a.okAnswers;
      if (await deps.send(auditEmail(a, n, siteUrl, from), a.leadId)) {
        await deps.markNotified(a.runId, true);
        out.sent++;
      } else {
        await deps.bumpAttempts(a.runId);
        log(`free audit notify: run ${a.runId} send failed`);
        out.sendErrors++;
      }
    } catch {
      log(`free audit notify: run ${a.runId} error`);
      out.sendErrors++;
    }
  }
  return out;
}
