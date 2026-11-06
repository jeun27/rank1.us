import { AI_RULES, SITE_RULES } from "./evaluate";
import { YOUTUBE_RULES } from "./youtube-rules";
import { unchecked, type FixResult, type RuleKey } from "./types";

// The cron route's maxDuration is 300 s; fix checks start only with ≥60 s left (lead, 2026-11-05),
// and only for one run per tick, inside evaluateFixes' 45 s crawl budget.
export const MIN_TIME_LEFT_MS = 60_000;

export type RunToCheck = { runId: string; businessId: string; domain: string | null };

export type FixCheckDeps = {
  next: () => Promise<RunToCheck | null>;
  // The enabled site rules (fix_rules.enabled, service role), read every tick.
  enabledRules: () => Promise<RuleKey[]>;
  evaluate: (business: { domain: string | null }, rules: RuleKey[]) => Promise<FixResult[]>;
  record: (businessId: string, runId: string, results: FixResult[]) => Promise<void>;
  // Narrows the rules to the ones that apply to this run's business (e.g. R19–R21 only with an active
  // YouTube connection). The unchecked fallbacks then use the narrowed list, so they add no rows either.
  applicable?: (run: RunToCheck, rules: RuleKey[]) => Promise<RuleKey[]>;
  timeLeftMs: () => number;
  log?: (line: string) => void;
};

export type FixCheckSummary = {
  checked: string | null;
  skipped?: "time" | "none" | "no_rules";
  fallback?: boolean;
  error?: string;
};

const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");

// One closed paid run per tick, for the rules enabled right now. If recording fails (e.g. a rule was
// disabled mid-tick), it retries once with every enabled rule unchecked 'error' and no new crawl, so the
// run gets its fix_checks rows and a site is never re-crawled every minute. Never throws.
export async function checkFixesForOneRun(deps: FixCheckDeps): Promise<FixCheckSummary> {
  const log = deps.log ?? ((l: string) => console.error(l));
  if (deps.timeLeftMs() < MIN_TIME_LEFT_MS) return { checked: null, skipped: "time" };
  let run: RunToCheck | null;
  let rules: RuleKey[];
  try {
    rules = (await deps.enabledRules()).filter(
      (r) => SITE_RULES.includes(r) || AI_RULES.includes(r) || (YOUTUBE_RULES as readonly RuleKey[]).includes(r),
    );
    if (!rules.length) return { checked: null, skipped: "no_rules" };
    run = await deps.next();
  } catch (e) {
    log(`fix check: failed (${codeOf(e)})`);
    return { checked: null, error: codeOf(e) };
  }
  if (!run) return { checked: null, skipped: "none" };
  if (deps.applicable) {
    try {
      rules = await deps.applicable(run, rules);
    } catch (e) {
      log(`fix check: failed (${codeOf(e)})`);
      return { checked: null, error: codeOf(e) };
    }
    if (!rules.length) return { checked: null, skipped: "no_rules" };
  }
  const results = await deps
    .evaluate({ domain: run.domain }, rules)
    .then((rs) => rs.filter((r) => rules.includes(r.rule_key)))
    .catch(() => rules.map((r) => unchecked(r, "error")));
  try {
    await deps.record(run.businessId, run.runId, results);
    return { checked: run.runId };
  } catch (first) {
    log(`fix check: record failed (${codeOf(first)}), marking unchecked`);
    try {
      await deps.record(
        run.businessId,
        run.runId,
        rules.map((r) => unchecked(r, "error")),
      );
      return { checked: run.runId, fallback: true };
    } catch (e) {
      log(`fix check: failed (${codeOf(e)})`);
      return { checked: null, error: codeOf(e) };
    }
  }
}
