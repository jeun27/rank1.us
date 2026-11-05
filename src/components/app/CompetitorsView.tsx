"use client";
import { useState } from "react";
import { Leaderboard } from "@/components/audit/AuditView";
import type { Loaded } from "@/components/audit/load";
import { PillField } from "@/components/forms/PillField";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatPercent } from "@/components/ui/StatNumber";
import type { LocalCompetitor } from "@/lib/onboarding/types";
import type { CompetitorInput, CompetitorRow } from "@/lib/queries/shell";
import { normalizeDomain } from "@/lib/spam/validate";
import { appCopy as c } from "./copy";
import { Page, Section } from "./Page";

type Actions = { add: (c: CompetitorInput) => Promise<unknown>; dismiss: (c: CompetitorInput) => Promise<unknown> };

const ghost =
  "inline-flex min-h-11 items-center rounded-full border border-fieldBorder bg-white px-4 text-ui font-semibold hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

// UI.md 4b Competitors. Share of voice lives here only (lead).
export function CompetitorsView({
  latest,
  tracked,
  suggestions,
  actions,
}: {
  latest: Loaded | null;
  tracked: CompetitorRow[];
  suggestions: LocalCompetitor[];
  actions: Actions;
  now: Date;
}) {
  const [done, setDone] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const rows = latest?.metrics.leaderboard ?? [];
  const empty = !tracked.length && !rows.some((r) => r.kind === "competitor");
  const sov = latest?.metrics.shareOfVoice;
  const input = (s: LocalCompetitor): CompetitorInput => ({
    name: s.name,
    domain: s.domain ?? null,
    maps_cid: s.cid,
    rating: s.rating ?? null,
  });
  const act = async (fn: Actions["add"], s: LocalCompetitor) => {
    await fn(input(s));
    setDone((d) => [...d, s.cid]);
  };

  return (
    <Page title={c.competitors}>
      {empty && (
        <Card>
          <p className="text-body-lg">{c.noCompetitors}</p>
        </Card>
      )}
      {latest && rows.length > 0 && (
        <>
          {sov && (
            <Card>
              <p className="text-caption font-semibold text-inkMuted">{c.shareOfVoice}</p>
              <p data-computed className="font-display text-h2 font-semibold tabular-nums">
                {`${formatPercent(sov)} (${sov.numerator} of ${sov.denominator})`}
              </p>
            </Card>
          )}
          {/* Phones: cards with the You row pinned first. */}
          <ul className="flex flex-col gap-2 md:hidden">
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
                    {b.tooFew ? "too few answers" : formatPercent(b.metric)}
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
          <ul className="flex flex-col gap-2">
            {suggestions
              .filter((s) => !done.includes(s.cid))
              .map((s) => (
                <li
                  key={s.cid}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span data-computed className="text-ui font-semibold">
                      {s.name}
                    </span>
                    <span data-computed className="text-caption text-inkMuted">
                      {s.domain}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className={ghost} onClick={() => act(actions.add, s)}>
                      {c.add}
                    </button>
                    <button type="button" className={ghost} onClick={() => act(actions.dismiss, s)}>
                      {c.notCompetitor}
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      )}

      <form
        noValidate
        className="flex flex-col gap-3 rounded-surface bg-white p-4 shadow-card md:p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await actions.add({ name: name.trim(), domain: domain.trim() ? normalizeDomain(domain) : null });
          setName("");
          setDomain("");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <PillField label="Name" name="competitor-name" value={name} onChange={(e) => setName(e.target.value)} />
          <PillField
            label="Domain"
            name="competitor-domain"
            icon="globe"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </div>
        <div>
          <button type="submit" className={ghost}>
            Add competitor
          </button>
        </div>
      </form>
    </Page>
  );
}
