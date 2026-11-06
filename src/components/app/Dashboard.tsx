import type { ReactNode } from "react";
import { EngineTable, Hero, Leaderboard } from "@/components/audit/AuditView";
import type { Loaded } from "@/components/audit/load";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Jelly } from "@/components/ui/Jelly";
import type { SeriesPoint } from "@/lib/metrics";
import { deltaTone, signedPts } from "@/lib/metrics/delta";
import type { TopFix } from "@/lib/queries/shell";
import { appCopy as c } from "./copy";
import { Page, Section } from "./Page";
import { VisibilityLine } from "./VisibilityLine";

// UI.md 4b Dashboard. No SoV here (lead: SoV only on Competitors).
export function Dashboard({
  business,
  latest,
  series,
  fixes,
  now,
  notice,
}: {
  business: { name: string; paid: boolean } | null;
  latest: Loaded | null;
  series: { points: SeriesPoint[]; visible: boolean };
  fixes: TopFix[];
  now: Date;
  // C-b: the connect card, after the hero (UX plan slot 3, after PR6's next-fix card), or first with no run.
  notice?: ReactNode;
}) {
  if (!business)
    return (
      <Page title={c.dashboard}>
        <Card>
          <div className="flex flex-col items-center gap-5 py-5 text-center">
            <Jelly size={80} />
            <p className="max-w-prose text-body-lg">{c.dashboardEmpty}</p>
            <Button href="/app/onboarding">{c.addBusiness}</Button>
          </div>
        </Card>
      </Page>
    );
  if (!latest)
    return (
      <Page title={c.dashboard}>
        {notice}
        <Card>
          {business.paid ? (
            <p className="text-body-lg">{c.noChecks}</p>
          ) : (
            <Button href="/app/billing">{c.startPaid}</Button>
          )}
        </Card>
      </Page>
    );
  const { run } = latest.results;
  const lead = latest.metrics.leaderboard.find((b) => b.kind === "business");
  return (
    <Page title={c.dashboard}>
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
      <Section title={c.fixNext} href="/app/fixes">
        {fixes.length ? (
          <ol className="flex flex-col divide-y divide-border border-y border-border">
            {fixes.map((f) => (
              <li key={f.id} data-computed className="py-3 text-ui">
                {f.title}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-ui">{c.noFixes}</p>
        )}
      </Section>
    </Page>
  );
}
