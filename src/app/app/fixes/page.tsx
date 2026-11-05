import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { Measured, Page, runMeasured } from "@/components/app/Page";
import { FixList } from "@/components/fixes/FixList";
import { fixCopy as c } from "@/components/fixes/copy";
import { listFixes } from "@/lib/queries/fixes";
import { setFixStatusAction } from "./actions";

export const metadata: Metadata = { title: "What to fix next - Rank1", robots: { index: false } };

// UI.md 4b Fix list. Every self-serve member may change a status; set_fix_status checks again.
export default async function FixesPage() {
  const { db, business, runs } = await loadShell();
  if (!business) redirect("/app");
  const { ranked, tidyUps, unchecked } = await listFixes(db, business.id);
  return (
    <Page title={c.title}>
      <Measured {...runMeasured(runs[0])} now={new Date()} />
      <FixList
        ranked={ranked}
        tidyUps={tidyUps}
        unchecked={unchecked}
        noDomain={!business.domain}
        canWrite
        onStatus={setFixStatusAction}
      />
    </Page>
  );
}
