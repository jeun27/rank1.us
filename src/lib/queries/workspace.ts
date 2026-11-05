import type { Metric } from "@/types/metrics";
import type { DbClient } from "./client";

export const ENGINES = ["chatgpt", "gemini", "google_aio", "perplexity"] as const;
export type Engine = (typeof ENGINES)[number];
export const ENGINE_LABEL: Record<Engine, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  google_aio: "Google AI Overview",
  perplexity: "Perplexity",
};

// Stored rows the team workspace reads. Read-only: nothing here writes.
export type WorkspaceRows = {
  business: { id: string; name: string; city: string | null; state: string | null };
  competitors: { name: string }[];
  questions: { id: string; short_text: string }[];
  runs: { id: string; started_at: string | null; finished_at: string | null }[];
  answers: {
    id: string;
    run_id: string;
    question_id: string | null;
    engine: Engine;
    run_index: number;
    status: "ok" | "failed" | "no_overview";
    mentioned: boolean | null;
    brands: { name: string; position: number }[] | null;
    location_supported: "exact" | "fallback_country" | null;
    checked_at: string;
  }[];
  citations: { answer_id: string; url: string; domain: string; title: string | null }[];
};

export async function getWorkspaceRows(db: DbClient, businessId: string): Promise<WorkspaceRows | null> {
  const must = <T>(r: { data: T | null; error: unknown }): T => {
    if (r.error) throw r.error;
    return r.data as T;
  };
  const { data: business, error } = await db
    .from("businesses")
    .select("id, name, city, state")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!business) return null;
  const [competitors, questions, runs] = await Promise.all([
    db.from("competitors").select("name").eq("business_id", businessId).eq("hidden", false).order("name"),
    db.from("questions").select("id, short_text").eq("business_id", businessId).eq("active", true).order("id"),
    db
      .from("runs")
      .select("id, started_at, finished_at")
      .eq("business_id", businessId)
      .eq("kind", "weekly")
      .in("status", ["partial", "complete"])
      .order("started_at", { ascending: false }),
  ]);
  const runIds = must(runs).map((r) => r.id);
  const answers = must(
    await db
      .from("answers")
      .select("id, run_id, question_id, engine, run_index, status, mentioned, brands, location_supported, checked_at")
      .in("run_id", runIds)
      .order("id"),
  ) as WorkspaceRows["answers"];
  // Joined on the run, not a list of answer ids: hundreds of ids overflow the request URL.
  const citations = must(
    await db
      .from("citations")
      .select("answer_id, url, domain, title, position, answers!inner(run_id)")
      .in("answers.run_id", runIds)
      .order("answer_id")
      .order("position"),
  ).map(({ answer_id, url, domain, title }) => ({ answer_id, url, domain, title }));
  return {
    business,
    competitors: must(competitors),
    questions: must(questions),
    runs: must(runs),
    answers,
    citations,
  };
}

const metric = (numerator: number, denominator: number): Metric => ({
  value: denominator ? numerator / denominator : null,
  numerator,
  denominator,
});

type Answer = WorkspaceRows["answers"][number];
const okAnswers = (xs: Answer[]) => xs.filter((a) => a.status === "ok");
// Failed and no-overview answers are not in the denominator.
const named = (xs: Answer[], test: (a: Answer) => boolean = (a) => a.mentioned === true) => {
  const ok = okAnswers(xs);
  return metric(ok.filter(test).length, ok.length);
};
const byEngine = (xs: Answer[]) =>
  Object.fromEntries(ENGINES.map((e) => [e, named(xs.filter((a) => a.engine === e))])) as Record<Engine, Metric>;

export type WorkspaceView = ReturnType<typeof buildWorkspace>;

// Every number the workspace shows is counted here from stored answers and citations.
export function buildWorkspace(rows: WorkspaceRows) {
  const runs = [...rows.runs].sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
  const answersOf = (runId: string) => rows.answers.filter((a) => a.run_id === runId);
  const citesOf = new Map<string, WorkspaceRows["citations"]>();
  for (const c of rows.citations) citesOf.set(c.answer_id, [...(citesOf.get(c.answer_id) ?? []), c]);

  const checks = runs.map((r) => {
    const xs = answersOf(r.id);
    const last =
      r.finished_at ??
      xs
        .map((a) => a.checked_at)
        .sort()
        .at(-1);
    // Postgres returns "+00:00", the seed "Z": one format so both sources build the same view.
    const finishedAt = last ? new Date(last).toISOString() : "";
    return {
      runId: r.id,
      finishedAt,
      total: xs.length,
      ok: okAnswers(xs).length,
      partial: xs.some((a) => a.status === "failed"),
      visibility: named(xs),
    };
  });
  const latestRun = runs[0];
  const latest = latestRun ? answersOf(latestRun.id) : [];

  const questions = rows.questions.map((q) => {
    const xs = latest.filter((a) => a.question_id === q.id);
    return {
      id: q.id,
      text: q.short_text,
      visibility: named(xs),
      byEngine: byEngine(xs),
      answers: [...xs]
        .sort((a, b) => ENGINES.indexOf(a.engine) - ENGINES.indexOf(b.engine) || a.run_index - b.run_index)
        .map((a) => ({
          id: a.id,
          engine: a.engine,
          runIndex: a.run_index,
          status: a.status,
          mentioned: a.mentioned,
          fallbackCountry: a.location_supported === "fallback_country",
          brands: (a.brands ?? []).map((b) => b.name),
          citations: (citesOf.get(a.id) ?? []).map(({ url, domain, title }) => ({ url, domain, title })),
        })),
    };
  });

  const competitors = [
    { name: rows.business.name, you: true },
    ...rows.competitors.map((c) => ({ name: c.name, you: false })),
  ]
    .map((c) => ({ ...c, named: named(latest, (a) => (a.brands ?? []).some((b) => b.name === c.name)) }))
    .sort(
      (a, b) => b.named.numerator - a.named.numerator || Number(b.you) - Number(a.you) || a.name.localeCompare(b.name),
    );

  const latestCites = latest.flatMap((a) => (citesOf.get(a.id) ?? []).map((c) => ({ ...c, engine: a.engine })));
  const domains = [...new Set(latestCites.map((c) => c.domain))]
    .map((domain) => ({ domain, links: latestCites.filter((c) => c.domain === domain).length }))
    .sort((a, b) => b.links - a.links || a.domain.localeCompare(b.domain));

  return {
    business: rows.business,
    checks,
    latest: {
      checkedAt: checks[0]?.finishedAt ?? null,
      answers: checks[0]?.ok ?? 0,
      visibility: named(latest),
      byEngine: byEngine(latest),
    },
    questions,
    competitors,
    sources: {
      links: latestCites.length,
      domains,
      byEngine: Object.fromEntries(ENGINES.map((e) => [e, latestCites.filter((c) => c.engine === e).length])) as Record<
        Engine,
        number
      >,
    },
  };
}
