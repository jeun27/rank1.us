import "server-only";
import type { DbClient } from "@/lib/queries/client";
import { listRunsNeedingFixChecks, recordFixResults } from "@/lib/queries/fixes";
import type { Json } from "@/types/db";
import { checkFixesForOneRun } from "./cron";
import { evaluateFixes, SITE_RULES } from "./evaluate";
import type { RuleKey } from "./types";

// The real dependencies on the service client. fix_rules is service-only, so the enabled-rule read
// lives here (re-read every tick, so a rule disabled since deploy is never evaluated).
export function checkFixesWith(db: DbClient, timeLeftMs: () => number) {
  return checkFixesForOneRun({
    async enabledRules() {
      const { data, error } = await db.from("fix_rules").select("key").eq("enabled", true).in("key", SITE_RULES);
      if (error) throw error;
      return (data ?? []).map((r) => r.key as RuleKey);
    },
    next: async () => (await listRunsNeedingFixChecks(db, 1))[0] ?? null,
    evaluate: (business, rules) => evaluateFixes(business, { rules }),
    record: (businessId, runId, results) =>
      recordFixResults(
        db,
        businessId,
        runId,
        results.map((r) => ({ ...r, evidence: r.evidence as Json })),
      ),
    timeLeftMs,
  });
}
