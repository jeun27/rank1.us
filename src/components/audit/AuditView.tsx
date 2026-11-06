import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Freshness } from "@/components/ui/Freshness";
import { Icon } from "@/components/ui/Icon";
import { Jelly } from "@/components/ui/Jelly";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatNumber, formatPercent } from "@/components/ui/StatNumber";
import { Table } from "@/components/ui/Table";
import type { Metric } from "@/types/metrics";
import { ENGINES, ENGINE_LABEL, type Metrics, type RunResults } from "./contract";
import { auditCopy as c } from "./copy";
import { progressFor } from "./progress";

const D = ({ children }: { children: ReactNode }) => <span data-computed>{children}</span>;
const namedText = (m: Metric) => `named in ${m.numerator} of ${m.denominator} answers`;
const points = (change: number | null) => (change === null ? "–" : `${change > 0 ? "+" : ""}${change} pts`);

// One page body for a paid run (/app/runs/[runId]) and the free audit (/audit/[token]).
export function AuditView({
  results,
  metrics,
  free,
  exportBase,
  now,
}: {
  results: RunResults;
  metrics: Metrics;
  free: boolean;
  exportBase: string;
  now: Date;
}) {
  const { run } = results;
  const running = run.status === "queued" || run.status === "running";
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-10 md:px-8 md:py-16">
      <div>
        <h1 className="font-display text-display font-semibold md:text-display-md">
          {free ? c.titleFree : c.titlePaid}
        </h1>
        <p data-computed className="mt-2 text-body-lg text-inkMuted">
          {results.label}
        </p>
      </div>
      {running ? (
        <Progress results={results} metrics={metrics} />
      ) : run.status === "failed" ? (
        <Banner tone="error">{c.runFailed}</Banner>
      ) : (
        <Results results={results} metrics={metrics} exportBase={exportBase} now={now} />
      )}
      {free && !running && run.status !== "failed" && (
        <Card>
          <Button href={`/signin?next=${encodeURIComponent("/app/billing")}`}>{c.paywall}</Button>
        </Card>
      )}
      {free && (
        <footer className="flex items-center gap-1.5 text-micro text-inkMuted">
          <Jelly size={12} decorative />
          {c.credit}
        </footer>
      )}
    </main>
  );
}

function Progress({ results, metrics }: { results: RunResults; metrics: Metrics }) {
  const p = progressFor(results.run, results.answers);
  return (
    <section className="flex flex-col gap-6">
      <LoadingState message={c.checking} done={p.done} total={p.total} />
      <ul className="flex flex-col gap-4">
        {p.engines.map((e) => {
          const finished = e.total > 0 && e.done >= e.total;
          return (
            <li key={e.engine} className="flex flex-col gap-2 rounded-card border border-border bg-white p-4">
              <p className="text-ui font-semibold">{ENGINE_LABEL[e.engine]}</p>
              {finished ? (
                <p className="text-caption tabular-nums">
                  <D>{namedText(metrics.visibility.byEngine[e.engine])}</D>
                </p>
              ) : (
                <>
                  <ProgressBar done={e.done} total={e.total} />
                  <p className="text-caption text-inkMuted">{c.stillChecking}</p>
                </>
              )}
              {e.failed > 0 && (
                <p data-computed className="text-caption text-brick">
                  {c.engineDown(ENGINE_LABEL[e.engine])}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Results({
  results,
  metrics,
  exportBase,
  now,
}: {
  results: RunResults;
  metrics: Metrics;
  exportBase: string;
  now: Date;
}) {
  const firstUrl = (domain: string) => results.citations.find((x) => x.domain === domain)?.url;
  const download =
    "inline-flex min-h-11 items-center gap-2 px-1.5 text-ui font-semibold text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";
  return (
    <>
      <Hero metrics={metrics} now={now} />

      <EngineTable results={results} metrics={metrics} />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3 font-semibold">{c.competitors}</h2>
        <Leaderboard metrics={metrics} />
      </section>

      {metrics.sources.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-h3 font-semibold">{c.sources}</h2>
          <ul className="flex flex-col divide-y divide-border border-y border-border text-caption">
            {metrics.sources.map((s) => {
              const url = firstUrl(s.domain);
              return (
                <li key={s.domain} className="flex items-center justify-between gap-4 py-2">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
                    >
                      <Icon name="link" className="size-4" />
                      <D>{s.domain}</D>
                    </a>
                  ) : (
                    <D>{s.domain}</D>
                  )}
                  <D>{`${s.count} ${s.count === 1 ? "link" : "links"}`}</D>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <a href={`${exportBase}/export.csv`} download className={download}>
          {c.downloadCsv}
          <Icon name="arrowRight" className="size-4" />
        </a>
        <a href={`${exportBase}/export.png`} download className={download}>
          {c.downloadPng}
          <Icon name="arrowRight" className="size-4" />
        </a>
      </div>
    </>
  );
}

// Shared with the self-serve Dashboard and Competitors pages (Step 8).
export function Hero({ metrics, now, children }: { metrics: Metrics; now: Date; children?: ReactNode }) {
  return (
    <Card>
      <div data-computed className="flex flex-col gap-3">
        <StatNumber metric={metrics.visibility} />
        {children}
        {metrics.freshness && (
          <Freshness checkedAt={metrics.freshness} answers={metrics.visibility.denominator} now={now} />
        )}
      </div>
    </Card>
  );
}

export function EngineTable({ results, metrics }: { results: RunResults; metrics: Metrics }) {
  const okEngine = (e: (typeof ENGINES)[number]) => results.answers.some((a) => a.engine === e && a.status === "ok");
  return (
    <Table
      caption={c.engine}
      columns={[
        { key: "e", header: c.engine },
        { key: "n", header: c.named, numeric: true },
      ]}
      rows={ENGINES.map((e) => ({
        e: <span className={okEngine(e) ? "" : "text-inkMuted"}>{ENGINE_LABEL[e]}</span>,
        n: okEngine(e) ? (
          <D>{namedText(metrics.visibility.byEngine[e])}</D>
        ) : (
          <D>
            <span className="text-inkMuted">{c.noAnswers(ENGINE_LABEL[e])}</span>
          </D>
        ),
      }))}
    />
  );
}

// top: the Dashboard's top 5. change: false drops the change column (Dashboard: visibility only).
// Phones stack the rows and pin the You row first (X8).
export function Leaderboard({ metrics, top, change = true }: { metrics: Metrics; top?: number; change?: boolean }) {
  const shown = metrics.leaderboard.slice(0, top);
  return (
    <Table
      caption={c.competitors}
      stack
      pin={(i) => shown[i].kind === "business"}
      columns={[
        { key: "b", header: c.business },
        { key: "v", header: c.visibility, numeric: true },
        ...(change ? [{ key: "c", header: c.change, numeric: true }] : []),
      ]}
      rows={shown.map((b) => ({
        b: (
          <span className="flex items-center gap-2">
            <D>{b.name}</D>
            {b.kind === "business" && <Badge tone="info">{c.you}</Badge>}
          </span>
        ),
        v: b.tooFew ? c.tooFew : <D>{`${formatPercent(b.metric)} (${namedText(b.metric)})`}</D>,
        c: <D>{points(b.change)}</D>,
      }))}
    />
  );
}
