import "server-only";
import { sendEmail } from "@/lib/email/resend";
import { findLocalCompetitors, readSite } from "@/lib/onboarding";
import type { DbClient } from "@/lib/queries/client";
import { listLocalPlaces } from "@/lib/queries/places";
import { bumpFreeAuditNotifyAttempts, listUnnotifiedFreeAudits, markFreeAuditNotified } from "@/lib/queries/results";
import { auditDailyLimit } from "@/lib/spam/rateLimit";
import type { Json } from "@/types/db";
import { notifyFreeAudits } from "./notify";
import { startFreeAudit, type FreeAuditLead } from "./start";

// The real dependencies, all on the service client.
export function startFreeAuditWith(db: DbClient, lead: FreeAuditLead) {
  return startFreeAudit(lead, {
    readSite: (domain) => readSite(domain),
    findLocalCompetitors: (input) => findLocalCompetitors(input),
    listLocalPlaces: (city, state) => listLocalPlaces(db, city, state),
    async createFreeAudit(p) {
      // The DB enforces AUDIT_DAILY_LIMIT too, so parallel requests can't pass the route's check together.
      const input = { ...p, daily_limit: auditDailyLimit() };
      const { data, error } = await db.rpc("create_free_audit", { p: input as unknown as Json });
      if (error) throw error;
      return data;
    },
  });
}

export function notifyFreeAuditsWith(db: DbClient) {
  return notifyFreeAudits({
    listUnnotified: () => listUnnotifiedFreeAudits(db),
    send: sendEmail,
    markNotified: (runId, sent) => markFreeAuditNotified(db, runId, sent),
    bumpAttempts: async (runId) => {
      await bumpFreeAuditNotifyAttempts(db, runId);
    },
  });
}
