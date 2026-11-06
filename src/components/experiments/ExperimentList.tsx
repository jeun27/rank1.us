"use client";
import { useState } from "react";
import { Dialog } from "@/components/billing/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { formatPercent } from "@/components/ui/StatNumber";
import type { ExperimentResult, ExperimentStatus, GroupResult } from "@/lib/metrics/experiment";
import type { Metric } from "@/types/metrics";
import { experimentCopy as c } from "./copy";

export type ExperimentCardView = {
  id: string;
  name: string;
  changeDate: string;
  status: ExperimentStatus;
  result: ExperimentResult | null;
};
type Result = Promise<{ error: string } | undefined | void>;
export type ExperimentActions = { end: (id: string) => Result; remove: (id: string) => Result };

const STATUS_TONE = { running: "info", done: "success", ended: "warn" } as const;

// Signed floored points, a real minus sign; never a %.
export const signedPts = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} pts`;

// "34% · n=160". On phones the n drops under the percent, so a group's numbers stack (UI.md: groups stacked).
function Share({ m }: { m: Metric }) {
  return (
    <span className="font-mono tabular-nums">
      <span data-pct>{formatPercent(m)}</span>
      <span className="max-md:hidden"> · </span>
      <span data-n className="text-inkMuted max-md:block">{`n=${m.denominator}`}</span>
    </span>
  );
}

function Row({ label, g }: { label: string; g: GroupResult }) {
  const cell = "border-t border-border px-3 py-2.5 text-right";
  return (
    <tr>
      <th scope="row" className="border-t border-border px-3 py-2.5 text-left font-medium">
        {label}
      </th>
      <td data-computed className={cell}>
        <Share m={g.before} />
      </td>
      <td data-computed className={cell}>
        <Share m={g.after} />
      </td>
      <td data-computed className={`${cell} font-mono tabular-nums`}>
        {signedPts(g.change ?? 0)}
      </td>
    </tr>
  );
}

function Results({ name, result }: { name: string; result: ExperimentResult | null }) {
  if (!result || result.tooFew) return <p className="text-ui text-text2">{c.tooFew}</p>;
  return (
    <>
      <div className="overflow-hidden rounded-card border border-border">
        <table aria-label={name} className="w-full border-collapse text-ui">
          <thead>
            <tr className="text-caption text-inkMuted">
              <td className="px-3 py-2" />
              {[c.before, c.after, c.change].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-right font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label={c.testQuestions} g={result.test} />
            <Row label={c.controlQuestions} g={result.control} />
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-3 text-ui">
        <span className="font-medium">{c.difference}</span>
        <span data-computed className="font-mono tabular-nums">
          {signedPts(result.difference ?? 0)}
        </span>
        <Badge tone="info">{result.label}</Badge>
      </p>
    </>
  );
}

// UI.md 4b Experiments: one card per test vs control, newest first. Writes only with canWrite.
export function ExperimentList({
  experiments,
  canWrite,
  actions,
}: {
  experiments: ExperimentCardView[];
  canWrite: boolean;
  actions?: ExperimentActions;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const write = canWrite && actions;
  const run = async (fn: () => Result) => {
    setFailed(false);
    const r = await fn().catch(() => ({ error: "failed" }));
    if (r && "error" in r) setFailed(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {failed && <Banner tone="error">{c.saveFailed}</Banner>}
      {experiments.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-card border border-border bg-white p-4 md:p-6">
          <p className="text-body">{c.empty}</p>
          {write && <Button href="/app/experiments/new">{c.start}</Button>}
        </div>
      ) : (
        write && (
          <div>
            <Button href="/app/experiments/new">{c.start}</Button>
          </div>
        )
      )}
      {experiments.map((e) => (
        <article key={e.id} className="flex flex-col gap-4 rounded-card border border-border bg-white p-4 md:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 data-computed className="text-ui font-semibold">
                {e.name}
              </h2>
              <p data-computed className="font-mono text-caption text-inkMuted tabular-nums">
                {e.changeDate}
              </p>
            </div>
            <span data-testid="status">
              <Badge tone={STATUS_TONE[e.status]}>{c.statuses[e.status]}</Badge>
            </span>
          </header>
          <Results name={e.name} result={e.result} />
          {write && (
            <div className="flex flex-wrap gap-3">
              {e.status === "running" && (
                <Button variant="alt" onClick={() => run(() => actions.end(e.id))}>
                  {c.end}
                </Button>
              )}
              <Button variant="alt" onClick={() => setConfirm(e.id)}>
                {c.remove}
              </Button>
            </div>
          )}
        </article>
      ))}
      {write && confirm && (
        <Dialog
          message={c.confirmDelete}
          confirm={c.remove}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const id = confirm;
            setConfirm(null);
            run(() => actions.remove(id));
          }}
        />
      )}
    </div>
  );
}
