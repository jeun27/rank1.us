import type { Json } from "@/types/db";
import type { DbClient } from "./client";

// G2 "Can AI see your site?" (0025): one stored check per run. Reads use the caller's client (members
// incl. the dfy_client, and the team on DFY); a free audit's check is read with the service client.

// The crawlers checked, in table order (robots.txt user-agent names).
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
] as const;
export type AiCrawler = (typeof AI_CRAWLERS)[number];

export type AiAccessOutcome = "good" | "blocked" | "js_empty" | "cloudflare" | "unreachable";

// line: the robots.txt line that decided it, or null when no rule matched.
export type CrawlerResult = { agent: AiCrawler; allowed: boolean; line: string | null };

export type AiAccessCheck = {
  run_id: string;
  business_id: string | null;
  domain: string;
  checked_at: string;
  outcome: AiAccessOutcome;
  crawlers: CrawlerResult[];
  visible_words: number | null;
  status_normal: number | null;
  status_gptbot: number | null;
  cloudflare: boolean;
  pages_checked: number;
  // Set on a failed check (outcome unreachable): a short code, never message text.
  error: string | null;
};

const COLUMNS =
  "run_id, business_id, domain, checked_at, outcome, crawlers, visible_words, status_normal, status_gptbot, cloudflare, pages_checked, error";

const toCheck = (r: Record<string, unknown>) => r as unknown as AiAccessCheck;

// A run's check, or null when there is none or the caller can't read it.
export async function getAiAccessCheck(db: DbClient, runId: string): Promise<AiAccessCheck | null> {
  const { data, error } = await db.from("ai_access_checks").select(COLUMNS).eq("run_id", runId).maybeSingle();
  if (error) throw error;
  return data ? toCheck(data) : null;
}

// The business's newest check (for the dashboard card), or null.
export async function getLatestAiAccessCheck(db: DbClient, businessId: string): Promise<AiAccessCheck | null> {
  const { data, error } = await db
    .from("ai_access_checks")
    .select(COLUMNS)
    .eq("business_id", businessId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toCheck(data) : null;
}

export type AiAccessInput = {
  domain: string;
  outcome: AiAccessOutcome;
  crawlers: CrawlerResult[];
  visibleWords: number | null;
  statusNormal: number | null;
  statusGptbot: number | null;
  cloudflare: boolean;
  pagesChecked: number;
  // A failed check: a short code (timeout, blocked_address, error or a PG code), never message text.
  errorCode?: string | null;
};

// Service client only. Stores (or replaces) a run's check. Errors: 22023 bad input or unknown run,
// 42501 any other caller. P5 fixes still go through recordFixResults (R14, R10, R16).
export async function recordAiAccessCheck(serviceDb: DbClient, runId: string, c: AiAccessInput): Promise<void> {
  const { error } = await serviceDb.rpc("record_ai_access_check", {
    p_run_id: runId,
    p: {
      domain: c.domain,
      outcome: c.outcome,
      crawlers: c.crawlers,
      visible_words: c.visibleWords,
      status_normal: c.statusNormal,
      status_gptbot: c.statusGptbot,
      cloudflare: c.cloudflare,
      pages_checked: c.pagesChecked,
      error: c.errorCode ?? null,
    } as unknown as Json,
  });
  if (error) throw error;
}

// Service client only. Finished free audits of the last 7 days with no check yet, oldest first
// (at most 100). The run-jobs hook takes 1 per tick. 42501 for any other caller.
export async function listRunsNeedingAiAccess(
  serviceDb: DbClient,
  limit: number,
): Promise<{ runId: string; domain: string }[]> {
  const { data, error } = await serviceDb.rpc("runs_needing_ai_access_check", { p_limit: limit });
  if (error) throw error;
  return data.map((r) => ({ runId: r.run_id, domain: r.domain }));
}
