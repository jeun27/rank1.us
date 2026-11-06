import { siteHost } from "@/lib/onboarding/read-site";
import type { AiAccessInput } from "@/lib/queries/ai-access";

// G2 for free audits (no business, so no fixes): the check is only stored for the run, for /audit.
// At most one per run-jobs tick, and only with ≥30 s of maxDuration left (3 requests × 5 s, worst case).
export const MIN_TIME_LEFT_MS = 30_000;

export type FreeAuditAccessDeps = {
  enabled: boolean;
  next: () => Promise<{ runId: string; domain: string } | null>;
  check: (domain: string) => Promise<AiAccessInput>;
  record: (runId: string, check: AiAccessInput) => Promise<void>;
  timeLeftMs: () => number;
  log?: (line: string) => void;
};

export type FreeAuditAccessSummary = {
  checked: number;
  // An 'unreachable' row was recorded instead of a full check (bad domain, a thrown check, or a refused
  // record retried as the minimal row), so the run still leaves the oldest-first queue.
  failed?: boolean;
  skipped?: "disabled" | "time" | "none";
  error?: string;
};

const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");

// ai_access_checks.error takes a short code only ([A-Za-z0-9_], ≤ 40): a PG code passes, anything else is "error".
const storableCode = (e: unknown) => {
  const c = codeOf(e);
  return /^[A-Za-z0-9_]{1,40}$/.test(c) ? c : "error";
};

const unreachable = (domain: string, errorCode: string): AiAccessInput => ({
  domain,
  errorCode,
  outcome: "unreachable",
  crawlers: [],
  visibleWords: null,
  statusNormal: null,
  statusGptbot: null,
  cloudflare: false,
  pagesChecked: 0,
});

// Never throws. Logs carry the PG code only, never a domain or run id.
export async function checkFreeAuditAccess(deps: FreeAuditAccessDeps): Promise<FreeAuditAccessSummary> {
  const log = deps.log ?? ((l: string) => console.error(l));
  if (!deps.enabled) return { checked: 0, skipped: "disabled" };
  if (deps.timeLeftMs() < MIN_TIME_LEFT_MS) return { checked: 0, skipped: "time" };
  try {
    const run = await deps.next();
    if (!run) return { checked: 0, skipped: "none" };
    // Normalised before anything else; an invalid domain is recorded without a fetch.
    const host = siteHost(run.domain);
    const domain = host ?? run.domain.trim().toLowerCase();
    let check: AiAccessInput;
    let failed = !host;
    if (!host) check = unreachable(domain, "bad_domain");
    else
      try {
        check = await deps.check(host);
      } catch (e) {
        log(`ai access: free audit check failed (${storableCode(e)})`);
        check = unreachable(host, storableCode(e));
        failed = true;
      }
    try {
      await deps.record(run.runId, check);
    } catch (e) {
      // The minimal row the RPC always accepts (backend, #116), so a refused record can't pin the queue.
      log(`ai access: free audit record refused (${codeOf(e)}), retrying minimal`);
      await deps.record(run.runId, unreachable(domain, "record_failed"));
      failed = true;
    }
    return failed ? { checked: 1, failed } : { checked: 1 };
  } catch (e) {
    log(`ai access: free audit failed (${codeOf(e)})`);
    return { checked: 0, error: codeOf(e) };
  }
}
