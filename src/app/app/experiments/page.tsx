import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { Page } from "@/components/app/Page";
import { ExperimentList } from "@/components/experiments/ExperimentList";
import { experimentCopy as c } from "@/components/experiments/copy";
import { computeExperiment } from "@/lib/metrics/experiment";
import { getExperimentData, listExperiments } from "@/lib/queries/experiments";
import { deleteExperimentAction, endExperimentAction } from "./actions";

export const metadata: Metadata = { title: "Experiments - Rank1", robots: { index: false } };

// UI.md 4b Experiments (Step 17): one card per test vs control. Self-serve members may write; the proxy
// 404s a dfy_client and RLS refuses one anyway.
export default async function ExperimentsPage() {
  const { db, business } = await loadShell();
  if (!business) redirect("/app");
  const rows = await listExperiments(db, business.id);
  const data = await Promise.all(rows.map((r) => getExperimentData(db, r.id)));
  return (
    <Page title={c.title}>
      <ExperimentList
        experiments={rows.map((r, i) => ({
          id: r.id,
          name: r.name,
          changeDate: r.change_date,
          status: r.status,
          result: data[i] ? computeExperiment({ test: data[i].test, control: data[i].control }) : null,
        }))}
        canWrite
        actions={{ end: endExperimentAction, remove: deleteExperimentAction }}
      />
    </Page>
  );
}
