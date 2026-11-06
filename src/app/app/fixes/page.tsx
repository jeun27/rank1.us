import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { latestMeasured, Measured, Page } from "@/components/app/Page";
import { AiAccessPanel } from "@/components/audit/AiAccessPanel";
import { FixList, type FixView } from "@/components/fixes/FixList";
import { getLatestAiAccessCheck } from "@/lib/queries/ai-access";
import { fixCopy as c } from "@/components/fixes/copy";
import { listDoneFixes, listFixes } from "@/lib/queries/fixes";
import { setFixStatusAction } from "./actions";

export const metadata: Metadata = { title: "What to fix next - Rank1", robots: { index: false } };

const G2_RULES = new Set(["R14", "R16", "R18"]);

// UI.md 4b Fix list. Every self-serve member may change a status; set_fix_status checks again.
export default async function FixesPage() {
  const { db, business, latest } = await loadShell();
  if (!business) redirect("/app");
  const [{ ranked, tidyUps, unchecked }, done, access] = await Promise.all([
    listFixes(db, business.id),
    listDoneFixes(db, business.id),
    process.env.ENABLE_AI_ACCESS_CHECK === "true" ? getLatestAiAccessCheck(db, business.id) : null,
  ]);
  const now = new Date();
  // G2 (lead 2026-11-06): the AI access panel is the evidence on the P5 fixes it decides.
  const withEvidence = (f: FixView): FixView =>
    access && G2_RULES.has(f.rule_key) ? { ...f, evidence: <AiAccessPanel check={access} now={now} level={4} /> } : f;
  return (
    <Page title={c.title}>
      <Measured {...latestMeasured(latest)} now={now} />
      <FixList
        ranked={ranked.map(withEvidence)}
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
