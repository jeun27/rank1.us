import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { latestMeasured, Measured, Page } from "@/components/app/Page";
import { FixList } from "@/components/fixes/FixList";
import { fixCopy as c } from "@/components/fixes/copy";
import { listDoneFixes, listFixes } from "@/lib/queries/fixes";
import { setFixStatusAction } from "./actions";

export const metadata: Metadata = { title: "What to fix next - Rank1", robots: { index: false } };

// UI.md 4b Fix list. Every self-serve member may change a status; set_fix_status checks again.
export default async function FixesPage() {
  const { db, business, latest } = await loadShell();
  if (!business) redirect("/app");
  const [{ ranked, tidyUps, unchecked }, done] = await Promise.all([
    listFixes(db, business.id),
    listDoneFixes(db, business.id),
  ]);
  return (
    <Page title={c.title}>
      <Measured {...latestMeasured(latest)} now={new Date()} />
      <FixList
        ranked={ranked}
        tidyUps={tidyUps}
        done={done}
        unchecked={unchecked}
        noDomain={!business.domain}
        canWrite
        onStatus={setFixStatusAction}
        baseline={latest?.metrics.visibility ?? null}
        baselineHref="/app"
      />
    </Page>
  );
}
