import type { Tables } from "@/types/db";
import type { Metric } from "@/types/metrics";
import type { DbClient } from "./client";

export type RunSummary = Pick<Tables<"runs">, "id" | "status" | "jobs_ok" | "jobs_total" | "finished_at"> & {
  visibility: Metric;
};

// Latest run of a business. Visibility = answers naming the business / ok answers;
// failed and no_overview answers are not in the denominator.
export async function getLatestRunSummary(db: DbClient, businessId: string): Promise<RunSummary | null> {
  const { data: run, error } = await db
    .from("runs")
    .select("id, status, jobs_ok, jobs_total, finished_at")
    .eq("business_id", businessId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!run) return null;

  const ok = () =>
    db.from("answers").select("id", { count: "exact", head: true }).eq("run_id", run.id).eq("status", "ok");
  const [all, named] = await Promise.all([ok(), ok().eq("mentioned", true)]);
  if (all.error) throw all.error;
  if (named.error) throw named.error;

  const denominator = all.count ?? 0;
  const numerator = named.count ?? 0;
  return { ...run, visibility: { value: denominator ? numerator / denominator : null, numerator, denominator } };
}
