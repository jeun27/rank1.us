import "server-only";
import type { DbClient } from "@/lib/queries/client";
import { listRunsNeedingAiAccess, recordAiAccessCheck } from "@/lib/queries/ai-access";
import { aiAccessEnabled, checkAiAccess } from "./ai-access";
import { checkFreeAuditAccess } from "./free-audit-access";

// The free-audit G2 hook on the service client (paid runs go through the fix pass instead).
export function checkFreeAuditAccessWith(
  db: DbClient,
  timeLeftMs: () => number,
  env: Record<string, string | undefined> = process.env,
) {
  return checkFreeAuditAccess({
    enabled: aiAccessEnabled(env),
    next: async () => (await listRunsNeedingAiAccess(db, 1))[0] ?? null,
    check: (domain) => checkAiAccess(domain),
    record: (runId, c) => recordAiAccessCheck(db, runId, c),
    timeLeftMs,
  });
}
