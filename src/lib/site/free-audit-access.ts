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

export type FreeAuditAccessSummary = { checked: number; skipped?: "disabled" | "time" | "none"; error?: string };

const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");

// Never throws. Logs carry the PG code only, never a domain or run id.
export async function checkFreeAuditAccess(deps: FreeAuditAccessDeps): Promise<FreeAuditAccessSummary> {
  const log = deps.log ?? ((l: string) => console.error(l));
  if (!deps.enabled) return { checked: 0, skipped: "disabled" };
  if (deps.timeLeftMs() < MIN_TIME_LEFT_MS) return { checked: 0, skipped: "time" };
  try {
    const run = await deps.next();
    if (!run) return { checked: 0, skipped: "none" };
    await deps.record(run.runId, await deps.check(run.domain));
    return { checked: 1 };
  } catch (e) {
    log(`ai access: free audit failed (${codeOf(e)})`);
    return { checked: 0, error: codeOf(e) };
  }
}
