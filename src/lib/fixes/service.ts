import "server-only";
import type { DbClient } from "@/lib/queries/client";
import { recordAiAccessCheck } from "@/lib/queries/ai-access";
import { listRunsNeedingFixChecks, recordFixResults, type RunNeedingFixChecks } from "@/lib/queries/fixes";
import { aiAccessEnabled, checkAiAccess } from "@/lib/site/ai-access";
import type { Json } from "@/types/db";
import { checkFixesForOneRun } from "./cron";
import { listMentionDecisions } from "@/lib/queries/mentions";
import { getRunResults } from "@/lib/queries/results";
import { AI_RULES, evaluateFixes, MENTION_RULES, SITE_RULES } from "./evaluate";
import { checkLists } from "./r17-lists";
import { checkCloudflare } from "./r16-cloudflare";
import { checkJsEmpty } from "./r18-js-empty";
import type { RuleKey } from "./types";

// The real dependencies on the service client. fix_rules is service-only, so the enabled-rule read
// lives here (re-read every tick, so a rule disabled since deploy is never evaluated).
// With ENABLE_AI_ACCESS_CHECK on, the same pass also runs the G2 check: it's stored for the run, and
// R16 and R18 join the run's single record_fix_results call (the RPC takes one call per run).
export function checkFixesWith(
  db: DbClient,
  timeLeftMs: () => number,
  env: Record<string, string | undefined> = process.env,
) {
  const ai = aiAccessEnabled(env);
  const mentions = env.ENABLE_MENTIONS === "true";
  let run: RunNeedingFixChecks | null = null;
  return checkFixesForOneRun({
    async enabledRules() {
      const keys = [...SITE_RULES, ...(ai ? AI_RULES : []), ...(mentions ? MENTION_RULES : [])];
      const { data, error } = await db.from("fix_rules").select("key").eq("enabled", true).in("key", keys);
      if (error) throw error;
      return (data ?? []).map((r) => r.key as RuleKey);
    },
    next: async () => (run = (await listRunsNeedingFixChecks(db, 1))[0] ?? null),
    async evaluate(business, rules) {
      const site = rules.filter((r) => !AI_RULES.includes(r) && !MENTION_RULES.includes(r));
      const results = site.length ? await evaluateFixes(business, { rules: site }) : [];
      if (run && rules.includes("R17"))
        results.push(checkLists(await getRunResults(db, run.runId), await listMentionDecisions(db, run.businessId)));
      if (!ai || !run) return results;
      const check = business.domain ? await checkAiAccess(business.domain) : null;
      if (check)
        await recordAiAccessCheck(db, run.runId, check).catch((e: unknown) =>
          console.error(
            `ai access: store failed (${typeof e === "object" && e && "code" in e ? String(e.code) : "error"})`,
          ),
        );
      return [
        ...results,
        ...(rules.includes("R16") ? [checkCloudflare(check)] : []),
        ...(rules.includes("R18") ? [checkJsEmpty(check)] : []),
      ];
    },
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
