"use client";
import { Leaderboard } from "@/components/audit/AuditView";
import type { Loaded } from "@/components/audit/load";
import { Card } from "@/components/ui/Card";
import { formatPercent } from "@/components/ui/StatNumber";
import type { LocalCompetitor } from "@/lib/onboarding/types";
import type { CompetitorRow } from "@/lib/queries/shell";
import { AddCompetitorForm, CompetitorSuggestions, type CompetitorActions } from "./CompetitorActions";
import { appCopy as c } from "./copy";
import { Measured, Page, Section } from "./Page";

// UI.md 4b Competitors. Share of voice lives here only (lead).
export function CompetitorsView({
  latest,
  tracked,
  suggestions,
  actions,
  now,
}: {
  latest: Loaded | null;
  tracked: CompetitorRow[];
  suggestions: LocalCompetitor[];
  actions: CompetitorActions;
  now: Date;
}) {
  const rows = latest?.metrics.leaderboard ?? [];
  const empty = !tracked.length && !rows.some((r) => r.kind === "competitor");
  const sov = latest?.metrics.shareOfVoice;

  return (
    <Page title={c.competitors}>
      {empty && (
        <Card>
          <p className="text-body-lg">{c.noCompetitors}</p>
        </Card>
      )}
      {latest && rows.length > 0 && (
        <>
          <Measured checkedAt={latest.metrics.freshness} answers={latest.metrics.visibility.denominator} now={now} />
          {sov && (
            <Card>
              <p className="text-caption font-semibold text-inkMuted">{c.shareOfVoice}</p>
              <p data-computed className="font-display text-h2 font-semibold tabular-nums">
                {`${formatPercent(sov)} (${sov.numerator} of ${sov.denominator})`}
              </p>
            </Card>
          )}
          <Leaderboard metrics={latest.metrics} />
        </>
      )}

      {suggestions.length > 0 && (
        <Section title={c.suggested} label={c.suggested}>
          <CompetitorSuggestions suggestions={suggestions} actions={actions} />
        </Section>
      )}

      <AddCompetitorForm add={actions.add} />
    </Page>
  );
}
