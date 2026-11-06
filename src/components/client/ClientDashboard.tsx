import type { ReactNode } from "react";
import { EngineTable, Hero, Leaderboard } from "@/components/audit/AuditView";
import type { Loaded } from "@/components/audit/load";
import { appCopy as c } from "@/components/app/copy";
import { HistoryTable } from "@/components/app/HistoryView";
import { Page, Section } from "@/components/app/Page";
import { VisibilityLine } from "@/components/app/VisibilityLine";
import { FixList, type DoneView, type FixView } from "@/components/fixes/FixList";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { seriesFromSummaries } from "@/lib/metrics";
import { deltaTone, signedPts } from "@/lib/metrics/delta";
import type { RunSummary } from "@/lib/queries/shell";

// COPY.md "UX (lead, 2026-11-06)" X25.
const teamFirst = "The team's first check runs Monday.";
// docs/COPY.md "Client invites (lead, 2026-11-05)": access removed. No button (nothing to set up).
const removed = "Nothing tracked yet.";

export type ClientFixes = {
  ranked: FixView[];
  tidyUps: FixView[];
  done?: DoneView[];
  unchecked: { rule_key: string; title: string }[];
  noDomain: boolean;
};

// Step 12: the DFY client's dashboard, read-only and visibility only. No share of voice, suggestions,
// competitor edits, status controls, billing or prices. fixes: only when the team shows the fix list.
export function ClientDashboard({
  business,
  latest,
  runs,
  fixes,
  now,
  notice,
}: {
  business: { name: string } | null;
  latest: Loaded | null;
  runs: RunSummary[];
  fixes: ClientFixes | null;
  now: Date;
  // C-b: the connect card, the slot below the hero (UX plan), or first with no run.
  notice?: ReactNode;
}) {
  if (!business)
    return (
      <Page title={c.dashboard}>
        <Card>
          <EmptyState message={removed} />
        </Card>
      </Page>
    );
  const name = (
    <p data-computed className="text-body-lg text-inkMuted">
      {business.name}
    </p>
  );
  // The team can show fixes before the first run (site checks), so the list doesn't wait for one.
  const fixList = fixes && (
    <Section title={c.fixNext}>
      <FixList {...fixes} canWrite={false} level={3} />
    </Section>
  );
  if (!latest)
    return (
      <Page title={c.dashboard}>
        {name}
        {notice}
        <Card>
          {/* X25: runs lists every status, so a queued or running one means the first check is underway. */}
          <EmptyState
            message={runs.some((r) => r.status === "queued" || r.status === "running") ? c.firstRunning : teamFirst}
          />
        </Card>
        {fixList}
      </Page>
    );
  const { run } = latest.results;
  const lead = latest.metrics.leaderboard.find((b) => b.kind === "business");
  const series = seriesFromSummaries(runs);
  return (
    <Page title={c.dashboard}>
      {name}
      <Hero metrics={latest.metrics} now={now}>
        <div className="flex flex-wrap gap-2">
          {lead?.change != null && (
            <Badge tone={deltaTone(lead.change)} mono>
              {signedPts(lead.change)}
            </Badge>
          )}
          {run.status === "partial" && <Badge tone="warn">{c.lastPartial(run.jobs_ok, run.jobs_total)}</Badge>}
        </div>
      </Hero>
      {notice}
      {series.visible && (
        <Section title={c.visibility}>
          <VisibilityLine points={series.points} />
        </Section>
      )}
      <EngineTable results={latest.results} metrics={latest.metrics} />
      <Section title={c.competitors}>
        <Leaderboard metrics={latest.metrics} top={5} change={false} />
      </Section>
      <Section title={c.history}>
        <HistoryTable runs={runs} linked={false} />
      </Section>
      {fixList}
    </Page>
  );
}
