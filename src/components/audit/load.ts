import "server-only";
import { computeMetrics, type MetricCitation, type Metrics } from "@/lib/metrics";
import { getFreeAuditByToken, getPreviousRun, getRunResults, type RunResults } from "@/lib/queries/results";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type Loaded = { results: RunResults; metrics: Metrics };

// citations.category is stored from categorize() (Step 6), so it is always one of its categories.
const cited = (r: RunResults) => r.citations as MetricCitation[];

// A paid run the signed-in member's workspace owns (RLS), with the change against the run before it.
export async function loadPaidRun(runId: string): Promise<Loaded | null> {
  const db = await createClient();
  const results = await getRunResults(db, runId);
  if (!results) return null;
  const previous = results.run.business_id ? await getPreviousRun(db, results.run.business_id, runId) : null;
  const metrics = computeMetrics({
    answers: results.answers,
    citations: cited(results),
    brands: results.brands,
    previous: previous ? { answers: previous.answers } : undefined,
  });
  return { results, metrics };
}

// The free audit for a lead token (service role: no signed-in reader exists). Null for an unknown token.
export async function loadFreeAudit(token: string): Promise<Loaded | null> {
  const results = await getFreeAuditByToken(createServiceClient(), token);
  if (!results) return null;
  const metrics = computeMetrics({
    answers: results.answers,
    citations: cited(results),
    brands: results.brands,
    freeAudit: true,
  });
  return { results, metrics };
}
