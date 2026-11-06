import type { ReactNode } from "react";
import { EngineTable, Hero, Leaderboard } from "@/components/audit/AuditView";
import type { Loaded } from "@/components/audit/load";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Mark } from "@/components/fixes/FixList";
import { fixCopy as f } from "@/components/fixes/copy";
import { Icon } from "@/components/ui/Icon";
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
  const next = fixes[0];
  const hero = (
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
  );
  return (
    <Page title={c.dashboard}>
      {/* X1: the answer, then the one next fix beside it. No open fix: the hero alone, full width. */}
      {next ? (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-12 md:items-start">
          <div className="md:col-span-7">{hero}</div>
          <NextFix fix={next} />
        </div>
      ) : (
        hero
      )}
      {notice}
      {series.visible && (
        <Section title={c.visibility}>
          <VisibilityLine points={series.points} />
        </Section>
      )}
      <Section title={c.competitors}>
        <Leaderboard metrics={latest.metrics} top={5} change={false} />
      </Section>
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-section font-medium md:min-h-8">
          <Icon
            name="chevronRight"
            className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          />
          {c.byEngine}
        </summary>
        <div className="mt-3">
          <EngineTable results={latest.results} metrics={latest.metrics} />
        </div>
      </details>
    </Page>
  );
}

// The first open fix in the Fix list order. Read-only: ticking it stays on the Fix list (undo, shortcuts).
function NextFix({ fix }: { fix: TopFix }) {
  return (
    <section
      aria-labelledby="next-fix"
      className="flex flex-col gap-2 rounded-surface bg-white p-3 shadow-card md:col-span-5 md:p-4"
    >
      <h2 id="next-fix" className="text-section font-medium text-inkMuted">
        {c.fixNext}
      </h2>
      <div className="flex items-start gap-3">
        <span
          role="img"
          data-computed
          aria-label={`${fix.title}: ${f.statuses[fix.status]}`}
          className="mt-px text-ink"
        >
          <Mark state={fix.status} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p data-computed className="text-ui font-semibold">
            {fix.title}
          </p>
          {fix.detail && (
            <p data-computed className="line-clamp-3 text-ui text-text2">
              {fix.detail}
            </p>
          )}
          {fix.affected_answers !== null && (
            <p data-computed className="text-caption text-inkMuted">
              {f.affected(fix.affected_answers)}
            </p>
          )}
        </div>
      </div>
      <div className="self-start">
        <Button variant="secondary" href={`/app/fixes#fix-${fix.id}`}>
          {c.fixNext}
        </Button>
      </div>
    </section>
  );
}
