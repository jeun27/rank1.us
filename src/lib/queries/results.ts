import type { EngineId } from "@/lib/engines/types";
import type { BrandMention, TrackedBrand } from "@/lib/runs/types";
import type { DbClient } from "./client";

// Customer-facing run results. Never includes raw engine output, cost, emails or tokens.
export type ResultsBrand = { name: string; kind: "business" | "competitor"; domain: string | null };

export type ResultsAnswer = {
  id: string;
  engine: EngineId;
  run_index: number;
  status: "ok" | "failed" | "no_overview";
  // null for free-audit answers, and for paid answers whose question was deleted (those don't count).
  question_id: string | null;
  question_text_used: string;
  mentioned: boolean | null;
  first_position: number | null;
  brands: BrandMention[] | null;
  location_used: string | null;
  location_supported: "exact" | "fallback_country" | null;
  checked_at: string;
};

export type ResultsCitation = {
  answer_id: string;
  url: string;
  domain: string;
  title: string | null;
  category: string | null;
  position: number;
};

export type RunResults = {
  run: {
    id: string;
    kind: "audit" | "weekly" | "free_audit";
    status: "queued" | "running" | "partial" | "complete" | "failed";
    jobs_total: number;
    jobs_ok: number;
    jobs_failed: number;
    started_at: string | null;
    finished_at: string | null;
    business_id: string | null;
  };
  // The business name, or the free audit's domain.
  label: string;
  brands: ResultsBrand[];
  answers: ResultsAnswer[];
  citations: ResultsCitation[];
};

const RUN_COLUMNS = "id, kind, status, jobs_total, jobs_ok, jobs_failed, started_at, finished_at, business_id";
const ANSWER_COLUMNS =
  "id, engine, run_index, status, question_id, question_text_used, mentioned, first_position, brands, location_used, location_supported, checked_at, citations(answer_id, url, domain, title, category, position)";

async function answersOf(db: DbClient, runId: string) {
  const { data, error } = await db
    .from("answers")
    .select(ANSWER_COLUMNS)
    .eq("run_id", runId)
    .order("checked_at")
    .order("id");
  if (error) throw error;
  const answers: ResultsAnswer[] = [];
  const citations: ResultsCitation[] = [];
  for (const { citations: cited, ...answer } of data) {
    answers.push(answer as unknown as ResultsAnswer);
    citations.push(...(cited as ResultsCitation[]).sort((a, b) => a.position - b.position));
  }
  return { answers, citations };
}

// A paid run (audit or weekly) the caller's workspace owns, via RLS. Null otherwise.
export async function getRunResults(db: DbClient, runId: string): Promise<RunResults | null> {
  const { data: run, error } = await db
    .from("runs")
    .select(RUN_COLUMNS)
    .eq("id", runId)
    .in("kind", ["audit", "weekly"])
    .maybeSingle();
  if (error) throw error;
  if (!run?.business_id) return null;

  const [business, competitors] = await Promise.all([
    db.from("businesses").select("name, domain").eq("id", run.business_id).maybeSingle(),
    db.from("competitors").select("name, domain").eq("business_id", run.business_id).eq("hidden", false).order("name"),
  ]);
  if (business.error) throw business.error;
  if (competitors.error) throw competitors.error;
  if (!business.data) return null;

  const brands: ResultsBrand[] = [
    { name: business.data.name, kind: "business", domain: business.data.domain },
    ...competitors.data.map((c) => ({ name: c.name, kind: "competitor" as const, domain: c.domain })),
  ];
  return { run: run as RunResults["run"], label: business.data.name, brands, ...(await answersOf(db, runId)) };
}

// Service client only. The free audit for a lead token, or null for an unknown token.
export async function getFreeAuditByToken(serviceDb: DbClient, token: string): Promise<RunResults | null> {
  const { data: lead, error } = await serviceDb.from("leads").select("run_id").eq("token", token).maybeSingle();
  if (error) throw error;
  if (!lead?.run_id) return null;

  const [run, snapshot] = await Promise.all([
    serviceDb.from("runs").select(RUN_COLUMNS).eq("id", lead.run_id).eq("kind", "free_audit").maybeSingle(),
    serviceDb.from("free_audits").select("domain, brands").eq("run_id", lead.run_id).maybeSingle(),
  ]);
  if (run.error) throw run.error;
  if (snapshot.error) throw snapshot.error;
  if (!run.data || !snapshot.data) return null;

  const { business, competitors } = snapshot.data.brands as { business: TrackedBrand; competitors: TrackedBrand[] };
  const brands: ResultsBrand[] = [
    { name: business.name, kind: "business", domain: business.domain },
    ...competitors.map((c) => ({ name: c.name, kind: "competitor" as const, domain: c.domain })),
  ];
  return {
    run: run.data as RunResults["run"],
    label: snapshot.data.domain,
    brands,
    ...(await answersOf(serviceDb, lead.run_id)),
  };
}

// The latest earlier complete or partial paid run (audit or weekly) of the business, for the
// leaderboard change. Null when there is none or the caller can't read it.
export async function getPreviousRun(
  db: DbClient,
  businessId: string,
  beforeRunId: string,
): Promise<RunResults | null> {
  const { data: before, error } = await db
    .from("runs")
    .select("started_at")
    .eq("id", beforeRunId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!before?.started_at) return null;

  const { data: previous, error: prevError } = await db
    .from("runs")
    .select("id")
    .eq("business_id", businessId)
    .in("kind", ["audit", "weekly"])
    .in("status", ["complete", "partial"])
    .lt("started_at", before.started_at)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevError) throw prevError;
  return previous ? getRunResults(db, previous.id) : null;
}

export type UnnotifiedFreeAudit = {
  runId: string;
  leadId: string;
  email: string;
  domain: string;
  token: string;
  status: "complete" | "partial" | "failed";
  // Answers with status 'ok' (the visibility denominator).
  okAnswers: number;
};

export const MAX_NOTIFY_ATTEMPTS = 5;

// Service client only. Finished free audits (complete, partial or failed) not yet notified,
// with fewer than MAX_NOTIFY_ATTEMPTS tries.
export async function listUnnotifiedFreeAudits(serviceDb: DbClient): Promise<UnnotifiedFreeAudit[]> {
  const { data, error } = await serviceDb
    .from("free_audits")
    .select("run_id, lead_id, domain, runs!inner(status), leads!inner(email, token)")
    .is("notified_at", null)
    .lt("notify_attempts", MAX_NOTIFY_ATTEMPTS)
    .in("runs.status", ["complete", "partial", "failed"])
    .order("created_at");
  if (error) throw error;

  return Promise.all(
    data.map(async (row) => {
      const run = row.runs as unknown as { status: UnnotifiedFreeAudit["status"] };
      const lead = row.leads as unknown as { email: string; token: string };
      const { count, error: countError } = await serviceDb
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("run_id", row.run_id)
        .eq("status", "ok");
      if (countError) throw countError;
      return {
        runId: row.run_id,
        leadId: row.lead_id,
        email: lead.email,
        domain: row.domain,
        token: lead.token,
        status: run.status,
        okAnswers: count ?? 0,
      };
    }),
  );
}

// Service client only. Marks a free audit handled: sent = whether the email went out.
export async function markFreeAuditNotified(serviceDb: DbClient, runId: string, sent: boolean): Promise<void> {
  const { error } = await serviceDb
    .from("free_audits")
    .update({ notified_at: new Date().toISOString(), notify_sent: sent })
    .eq("run_id", runId);
  if (error) throw error;
}

// Service client only. Counts one failed notify try (after MAX_NOTIFY_ATTEMPTS it stops being listed).
export async function bumpFreeAuditNotifyAttempts(serviceDb: DbClient, runId: string): Promise<void> {
  const { data, error } = await serviceDb.from("free_audits").select("notify_attempts").eq("run_id", runId).single();
  if (error) throw error;
  const { error: updateError } = await serviceDb
    .from("free_audits")
    .update({ notify_attempts: data.notify_attempts + 1 })
    .eq("run_id", runId);
  if (updateError) throw updateError;
}
