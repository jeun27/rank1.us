"use client";
import { Leaderboard } from "@/components/audit/AuditView";
import type { Loaded } from "@/components/audit/load";
import { Badge } from "@/components/ui/Badge";
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
          {/* Phones: cards with the You row pinned first. */}
          <ul aria-label={c.competitors} className="flex flex-col gap-2 md:hidden">
            {[...rows]
              .sort((a, b) => Number(b.kind === "business") - Number(a.kind === "business"))
              .map((b) => (
                <li
                  key={b.name}
                  className="flex items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-3"
                >
                  <span className="flex items-center gap-2">
                    <span data-computed className="text-ui font-semibold">
                      {b.name}
                    </span>
                    {b.kind === "business" && <Badge tone="info">You</Badge>}
                  </span>
                  <span data-computed className="text-caption tabular-nums">
                    {b.tooFew
                      ? "too few answers"
                      : `${formatPercent(b.metric)} (named in ${b.metric.numerator} of ${b.metric.denominator} answers)`}
                  </span>
                </li>
              ))}
          </ul>
          <div className="max-md:hidden">
            <Leaderboard metrics={latest.metrics} />
          </div>
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
