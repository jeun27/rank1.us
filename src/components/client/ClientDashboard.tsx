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
import { Jelly } from "@/components/ui/Jelly";
import { seriesFromSummaries } from "@/lib/metrics";
import type { RunSummary } from "@/lib/queries/shell";

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
  // C-b: the connect card, under the business name (ENABLE_CONNECTIONS).
  notice?: ReactNode;
}) {
  if (!business)
    return (
      <Page title={c.dashboard}>
        <Card>
          <div className="flex flex-col items-center gap-5 py-5 text-center">
            <Jelly size={80} />
            <p className="max-w-prose text-body-lg">{removed}</p>
          </div>
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
          <p className="text-body-lg">{c.noChecks}</p>
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
      {notice}
      <Hero metrics={latest.metrics} now={now}>
        <div className="flex flex-wrap gap-2">
          {lead?.change != null && <Badge tone="info">{`${lead.change > 0 ? "+" : ""}${lead.change} pts`}</Badge>}
          {run.status === "partial" && <Badge tone="warn">{c.lastPartial(run.jobs_ok, run.jobs_total)}</Badge>}
        </div>
      </Hero>
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
