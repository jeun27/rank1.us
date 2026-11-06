import "server-only";
import { computeMetrics, type MetricCitation, type Metrics } from "@/lib/metrics";
import { getAiAccessCheck, type AiAccessCheck } from "@/lib/queries/ai-access";
import { getFreeAuditByToken, getPreviousRun, getRunResults, type RunResults } from "@/lib/queries/results";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type Loaded = { results: RunResults; metrics: Metrics };
// G2: a free audit also carries its stored AI access check (null without one, or with the flag off).
export type LoadedFree = Loaded & { aiAccess: AiAccessCheck | null };

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
export async function loadFreeAudit(token: string): Promise<LoadedFree | null> {
  const db = createServiceClient();
  const results = await getFreeAuditByToken(db, token);
  if (!results) return null;
  const metrics = computeMetrics({
    answers: results.answers,
    citations: cited(results),
    brands: results.brands,
    freeAudit: true,
  });
  const aiAccess = process.env.ENABLE_AI_ACCESS_CHECK === "true" ? await getAiAccessCheck(db, results.run.id) : null;
  return { results, metrics, aiAccess };
}
