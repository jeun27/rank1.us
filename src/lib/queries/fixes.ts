import type { Json } from "@/types/db";
import type { DbClient } from "./client";

// What to fix next. Customer text is fixes.title/detail only: never why_note, data_source,
// unverified, threshold or vendor stats.

export const FIX_SIZES = ["S", "S-M", "M", "M-L", "L"] as const;
export type FixSize = (typeof FIX_SIZES)[number];
export type FixStatus = "todo" | "doing" | "done";

export type FixItem = {
  id: string;
  rule_key: string;
  size: FixSize;
  title: string;
  detail: string | null;
  evidence: Json | null;
  // null for site rules (no answer-derived rule is enabled yet); the UI hides it then.
  affected_answers: number | null;
  status: "todo" | "doing";
  first_seen_run: string | null;
  last_seen_run: string | null;
};

export type FixList = {
  // Open fixes, smallest effort first (S, S-M, M, M-L, L), then rule key. Never hygiene rules.
  ranked: FixItem[];
  // Open hygiene fixes (H1), shown only under "Tidy-ups".
  tidyUps: FixItem[];
  // Rules the latest checked run couldn't check ("We couldn't check this yet.").
  unchecked: string[];
  lastRunId: string | null;
};

const FIX_COLUMNS =
  "id, rule_key, size, title, detail, evidence, affected_answers, status, first_seen_run, last_seen_run";

const bySize = (a: FixItem, b: FixItem) =>
  FIX_SIZES.indexOf(a.size) - FIX_SIZES.indexOf(b.size) ||
  a.rule_key.localeCompare(b.rule_key, "en", { numeric: true });

// Open fixes of a business split into ranked and tidy-ups (by the rule's group).
export async function openFixes(db: DbClient, businessId: string): Promise<{ ranked: FixItem[]; tidyUps: FixItem[] }> {
  const [fixes, rules] = await Promise.all([
    db.from("fixes").select(FIX_COLUMNS).eq("business_id", businessId).in("status", ["todo", "doing"]),
    db.from("fix_rules_public").select("key, grp"),
  ]);
  if (fixes.error) throw fixes.error;
  if (rules.error) throw rules.error;
  const hygiene = new Set(rules.data.filter((r) => r.grp === "hygiene").map((r) => r.key));
  const items = (fixes.data as FixItem[]).sort(bySize);
  return {
    ranked: items.filter((f) => !hygiene.has(f.rule_key)),
    tidyUps: items.filter((f) => hygiene.has(f.rule_key)),
  };
}

// The fix list a member may see through RLS (self-serve and team always; dfy_client only when
// fix_list_visible). A caller who can't see it gets empty lists.
export async function listFixes(db: DbClient, businessId: string): Promise<FixList> {
  const [{ ranked, tidyUps }, checks] = await Promise.all([
    openFixes(db, businessId),
    db
      .from("fix_checks")
      .select("run_id, rule_key, result, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .order("rule_key")
      .limit(50),
  ]);
  if (checks.error) throw checks.error;
  const lastRunId = checks.data[0]?.run_id ?? null;
  const unchecked = checks.data
    .filter((c) => c.run_id === lastRunId && c.result === "unchecked")
    .map((c) => c.rule_key)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  return { ranked, tidyUps, unchecked, lastRunId };
}

// Sets a fix's status (self-serve members and team only). Errors: 42501 not allowed or not
// found, 22023 bad status, 23505 reopening while another fix for the rule is open.
export async function setFixStatus(db: DbClient, fixId: string, status: FixStatus): Promise<void> {
  const { error } = await db.rpc("set_fix_status", { p_fix_id: fixId, p_status: status });
  if (error) throw error;
}

export type FixCheckResult = {
  rule_key: string;
  result: "fix" | "ok" | "unchecked";
  evidence: Json | null;
  // The filled customer copy; required for 'fix', ignored otherwise.
  detail: string | null;
};

// Service client only. Records one closed paid run's detector results (idempotent per run).
// Errors: 42501 not the service role, 22023 bad run or results (unknown or disabled rule).
export async function recordFixResults(
  serviceDb: DbClient,
  businessId: string,
  runId: string,
  results: FixCheckResult[],
): Promise<void> {
  const { error } = await serviceDb.rpc("record_fix_results", {
    p_business_id: businessId,
    p_run_id: runId,
    p_results: results as unknown as Json,
  });
  if (error) throw error;
}

export type RunNeedingFixChecks = { runId: string; businessId: string; domain: string | null };

// Service client only. Complete/partial audit and weekly runs with no recorded fix checks, oldest first.
export async function listRunsNeedingFixChecks(serviceDb: DbClient, limit = 1): Promise<RunNeedingFixChecks[]> {
  const { data, error } = await serviceDb.rpc("runs_needing_fix_checks", { p_limit: limit });
  if (error) throw error;
  return (data ?? []).map((r) => ({ runId: r.run_id, businessId: r.business_id, domain: r.domain }));
}
