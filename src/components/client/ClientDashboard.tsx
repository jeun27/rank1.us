import type { ReactNode } from "react";
import { EngineTable, Hero, Leaderboard } from "@/components/audit/AuditView";
import type { Loaded } from "@/components/audit/load";
import { appCopy as c } from "@/components/app/copy";
import { HistoryTable } from "@/components/app/HistoryView";
import { Page, Section } from "@/components/app/Page";
import { VisibilityLine } from "@/components/app/VisibilityLine";
import { FixList, Mark, statusLine, type DoneView, type FixView } from "@/components/fixes/FixList";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { seriesFromSummaries } from "@/lib/metrics";
import { deltaTone, signedPts } from "@/lib/metrics/delta";
import type { RunSummary } from "@/lib/queries/shell";

// COPY.md "UX (lead, 2026-11-06)" X25.
const teamFirst = "The team's first check runs Monday.";
// COPY.md "UX (lead, 2026-11-06)" X3.
const teamDid = "What the team did";
// X3: /client shows the last 4 weekly checks (founder OK); there's no /client history page.
const HISTORY_ROWS = 4;

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
  narrative,
}: {
  business: { name: string } | null;
  latest: Loaded | null;
  runs: RunSummary[];
  fixes: ClientFixes | null;
  now: Date;
  // C-b: the connect card, the slot below the hero (UX plan), or first with no run.
  notice?: ReactNode;
  // Q4: the read-only narrative clash card, after the notice and before Visibility (the /app Dashboard's slot).
  narrative?: ReactNode;
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
  // X3: what the team did, first: in progress, then done (newest first). Only when the team shows fixes.
  const doing = (fixes?.ranked ?? []).filter((f) => f.status === "doing");
  const done = [...(fixes?.done ?? [])].sort((a, b) =>
    (b.status_changed_at ?? "").localeCompare(a.status_changed_at ?? ""),
  );
  const did = doing.length + done.length > 0 && (
    <section aria-labelledby="team-did" className="flex flex-col gap-3">
      <h2 id="team-did" className="heading-gradient font-display text-section font-medium">
        {teamDid}
      </h2>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {[
          ...doing.map((f) => ({
            id: f.id,
            title: f.title,
            state: "doing" as const,
            line: statusLine("doing", f.status_changed_at ?? null, f.changed_by ?? null),
          })),
          ...done.map((f) => ({
            id: f.id,
            title: f.title,
            state: "done" as const,
            line: statusLine("done", f.status_changed_at, f.changed_by),
          })),
        ].map((r) => (
          <li key={r.id} className="flex items-start gap-3 py-3">
            <span aria-hidden className="mt-px text-ink">
              <Mark state={r.state} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p data-computed className="text-ui font-medium">
                {r.title}
              </p>
              <p data-computed className="text-caption text-inkMuted">
                {r.line}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
  if (!latest)
    return (
      <Page title={c.dashboard}>
        {name}
        {did}
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
      {did}
      {notice}
      {narrative}
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
        <HistoryTable runs={runs.slice(0, HISTORY_ROWS)} linked={false} />
      </Section>
      {fixList}
    </Page>
  );
}
