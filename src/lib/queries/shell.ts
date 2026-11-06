import { ENGINE_IDS, type EngineId } from "@/lib/engines/types";
import { metric } from "@/lib/metrics/compute";
import type { Category } from "@/lib/runs/categorize";
import type { Metric } from "@/types/metrics";
import type { DbClient } from "./client";
import { openFixes } from "./fixes";

// Queries for the self-serve /app shell. All take the signed-in member's client, so RLS decides.

export type CurrentBusiness = {
  id: string;
  name: string;
  domain: string | null;
  cuisine: string | null;
  city: string;
  state: string;
  country: string;
  // The workspace's subscription is active or trialing (the status itself is never returned).
  paid: boolean;
};

// The caller's current business: `selectedId` when it is one of their workspace's active self-serve
// businesses (the switcher's choice), else the oldest one. Null without a business.
export async function getCurrentBusiness(db: DbClient, selectedId?: string | null): Promise<CurrentBusiness | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: member, error } = await db
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", auth.user.id)
    .order("created_at")
    .order("workspace_id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!member) return null;
  const { data, error: bizError } = await db
    .from("businesses")
    .select("id, name, domain, cuisine, city, state, country, workspaces(subscription_status)")
    .eq("workspace_id", member.workspace_id)
    .eq("service", "self_serve")
    .is("archived_at", null)
    .order("created_at")
    .order("id");
  if (bizError) throw bizError;
  const picked = data.find((b) => b.id === selectedId) ?? data[0];
  if (!picked) return null;
  const { workspaces, ...business } = picked;
  const status = (workspaces as { subscription_status: string | null } | null)?.subscription_status;
  return { ...business, paid: status === "active" || status === "trialing" };
}

export type RunSummary = {
  id: string;
  kind: "audit" | "weekly";
  status: "queued" | "running" | "partial" | "complete" | "failed";
  jobs_total: number;
  jobs_ok: number;
  jobs_failed: number;
  started_at: string | null;
  finished_at: string | null;
  // Same exclusions as computeMetrics: ok answers whose question still exists.
  visibility: Metric;
  perEngine: Record<EngineId, Metric>;
};

// Audit and weekly runs of a business, newest first, with visibility counts (public.run_summaries).
// Pass statuses (e.g. ["complete", "partial"]) to get the newest `limit` runs with those statuses only.
export async function listRunSummaries(
  db: DbClient,
  businessId: string,
  limit = 8,
  statuses?: RunSummary["status"][],
): Promise<RunSummary[]> {
  const { data, error } = await db.rpc("run_summaries", {
    p_business_id: businessId,
    p_limit: limit,
    ...(statuses ? { p_statuses: statuses } : {}),
  });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const per = r.per_engine as Record<EngineId, { named: number; n: number }>;
    return {
      id: r.run_id,
      kind: r.kind as RunSummary["kind"],
      status: r.status as RunSummary["status"],
      jobs_total: r.jobs_total,
      jobs_ok: r.jobs_ok,
      jobs_failed: r.jobs_failed,
      started_at: r.started_at,
      finished_at: r.finished_at,
      visibility: metric(r.named, r.n),
      perEngine: Object.fromEntries(ENGINE_IDS.map((e) => [e, metric(per[e]?.named ?? 0, per[e]?.n ?? 0)])) as Record<
        EngineId,
        Metric
      >,
    };
  });
}

export type TopFix = {
  id: string;
  rule_key: string;
  size: string;
  title: string;
  detail: string | null;
  // null for site rules; the UI hides it then.
  affected_answers: number | null;
  status: "todo" | "doing";
};

// The Dashboard's top open fixes, in the Fix list order (pillar, size, rule key), never tidy-ups (H1).
// Reads only the fixes row (never fix_rules.why_note).
export async function getTopFixes(db: DbClient, businessId: string, limit = 3): Promise<TopFix[]> {
  const { ranked } = await openFixes(db, businessId);
  return ranked.slice(0, limit).map(({ id, rule_key, size, title, detail, affected_answers, status }) => ({
    id,
    rule_key,
    size,
    title,
    detail,
    affected_answers,
    status,
  }));
}

export type QuestionAnswer = {
  engine: EngineId;
  run_index: number;
  status: "ok" | "failed" | "no_overview";
  mentioned: boolean | null;
  text: string | null;
  location_used: string | null;
  location_supported: "exact" | "fallback_country" | null;
  checked_at: string;
  // Only links the engine returned; category from the rules or a manual override (Step 6).
  citations: { url: string; domain: string; title: string | null; position: number; category: Category | null }[];
};

export type QuestionWithAnswers = {
  id: string;
  // The active form (short or long).
  text: string;
  active: boolean;
  location_level: "country" | "state" | "city";
  country: string | null;
  state: string | null;
  city: string | null;
  answers: QuestionAnswer[];
};

export type QuestionsWithLatestAnswers = {
  run: { id: string; finished_at: string | null } | null;
  questions: QuestionWithAnswers[];
};

// Every question of the business (active first) with its answers from the latest complete or
// partial audit/weekly run. No raw engine output and no cost.
export async function getQuestionsWithLatestAnswers(
  db: DbClient,
  businessId: string,
): Promise<QuestionsWithLatestAnswers> {
  const [questions, latest] = await Promise.all([
    db
      .from("questions")
      .select("id, short_text, long_text, active_form, active, location_level, country, state, city")
      .eq("business_id", businessId)
      .order("active", { ascending: false })
      .order("short_text")
      .order("id"),
    db
      .from("runs")
      .select("id, finished_at")
      .eq("business_id", businessId)
      .in("kind", ["audit", "weekly"])
      .in("status", ["complete", "partial"])
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (questions.error) throw questions.error;
  if (latest.error) throw latest.error;

  const byQuestion = new Map<string, QuestionAnswer[]>();
  if (latest.data) {
    const { data, error } = await db
      .from("answers")
      .select(
        "question_id, engine, run_index, status, mentioned, text, location_used, location_supported, checked_at, citations(url, domain, title, position, category)",
      )
      .eq("run_id", latest.data.id)
      .not("question_id", "is", null)
      .order("engine")
      .order("run_index");
    if (error) throw error;
    for (const { question_id, citations, ...answer } of data) {
      const list = byQuestion.get(question_id!) ?? [];
      list.push({
        ...(answer as Omit<QuestionAnswer, "citations">),
        citations: [...(citations as QuestionAnswer["citations"])].sort((a, b) => a.position - b.position),
      });
      byQuestion.set(question_id!, list);
    }
  }

  return {
    run: latest.data,
    questions: questions.data.map((q) => ({
      id: q.id,
      text: q.active_form === "long" && q.long_text ? q.long_text : q.short_text,
      active: q.active,
      location_level: q.location_level as QuestionWithAnswers["location_level"],
      country: q.country,
      state: q.state,
      city: q.city,
      answers: byQuestion.get(q.id) ?? [],
    })),
  };
}

export type CompetitorRow = {
  id: string;
  name: string;
  domain: string | null;
  source: "maps" | "manual" | "suggested";
  rating: number | null;
};

// Tracked competitors (hidden = false) and dismissed ones (hidden = true, never suggested again).
export async function listCompetitors(
  db: DbClient,
  businessId: string,
): Promise<{ tracked: CompetitorRow[]; dismissed: CompetitorRow[] }> {
  const { data, error } = await db
    .from("competitors")
    .select("id, name, domain, source, rating, hidden")
    .eq("business_id", businessId)
    .order("name")
    .order("id");
  if (error) throw error;
  const row = (c: (typeof data)[number]): CompetitorRow => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    source: c.source as CompetitorRow["source"],
    rating: c.rating,
  });
  return { tracked: data.filter((c) => !c.hidden).map(row), dismissed: data.filter((c) => c.hidden).map(row) };
}

export type CompetitorInput = {
  name: string;
  domain?: string | null;
  maps_cid?: string | null;
  rating?: number | null;
};

// Tracks a competitor. Re-adding a dismissed or existing one (same domain, else same name)
// un-hides it instead of duplicating. Returns its id. Errors: 42501 not allowed, 22023 bad input.
export async function addCompetitor(
  db: DbClient,
  businessId: string,
  input: CompetitorInput & { source: "maps" | "manual" },
): Promise<string> {
  const { data, error } = await db.rpc("add_competitor", { p_business_id: businessId, p: input });
  if (error) throw error;
  return data;
}

// "Not a competitor": hides it (or stores it hidden, source 'suggested') so it isn't suggested
// again. Idempotent. Returns its id. Errors: 42501 not allowed, 22023 bad input.
export async function dismissSuggestion(db: DbClient, businessId: string, input: CompetitorInput): Promise<string> {
  const { data, error } = await db.rpc("dismiss_competitor", { p_business_id: businessId, p: input });
  if (error) throw error;
  return data;
}
