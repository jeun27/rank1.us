"use client";
import { Leaderboard } from "@/components/audit/AuditView";
import type { Loaded } from "@/components/audit/load";
import { Card } from "@/components/ui/Card";
import { formatPercent } from "@/components/ui/StatNumber";
import type { LocalCompetitor } from "@/lib/onboarding/types";
import type { CompetitorRow } from "@/lib/queries/shell";
import { Icon } from "@/components/ui/Icon";
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
          {/* X13: the leaderboard is the one focal block; share of voice is a caption under it, with its n. */}
          <Leaderboard metrics={latest.metrics} change={rows.some((r) => r.change != null)} />
          {sov && (
            <p className="-mt-5 text-caption text-inkMuted">
              <span>{c.shareOfVoice}</span>:{" "}
              <span
                data-computed
                className="font-mono"
              >{`${formatPercent(sov)} (${sov.numerator} of ${sov.denominator})`}</span>
            </p>
          )}
        </>
      )}

      {suggestions.length > 0 && (
        <Section title={c.suggested} label={c.suggested}>
          <CompetitorSuggestions suggestions={suggestions} actions={actions} />
        </Section>
      )}

      {/* X26: with competitors tracked, adding one more is a side step, folded behind a text action. */}
      {empty ? (
        <AddCompetitorForm add={actions.add} />
      ) : (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-ui text-link underline underline-offset-4 md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep">
            Add competitor
            <Icon
              name="chevronRight"
              className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
          </summary>
          <div className="mt-3">
            <AddCompetitorForm add={actions.add} />
          </div>
        </details>
      )}
    </Page>
  );
}
