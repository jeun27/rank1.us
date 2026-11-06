"use client";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { formatPercent } from "@/components/ui/StatNumber";
import type { ExperimentResult, ExperimentStatus, GroupResult } from "@/lib/metrics/experiment";
import type { Metric } from "@/types/metrics";
import { signedPts } from "@/lib/metrics/delta";
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
      <td data-computed className={`${cell} font-mono whitespace-nowrap tabular-nums`}>
        {signedPts(g.change ?? 0)}
      </td>
    </tr>
  );
}

function Results({ name, result }: { name: string; result: ExperimentResult | null }) {
  if (!result || result.tooFew) return <p className="text-ui text-text2">{c.tooFew}</p>;
  return (
    <>
      <p className="flex flex-wrap items-center gap-3 text-ui">
        <span className="font-medium">{c.difference}</span>
        <span data-computed className="font-mono tabular-nums">
          {signedPts(result.difference ?? 0)}
        </span>
        <Badge tone="info">{result.label}</Badge>
      </p>
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
            <CardActions
              id={e.id}
              running={e.status === "running"}
              onEnd={() => run(() => actions.end(e.id))}
              onDelete={() => run(() => actions.remove(e.id))}
            />
          )}
        </article>
      ))}
    </div>
  );
}

// X14 + X29: End test stays a button; Delete test is a far-right text action that confirms in place.
// Focus moves to Cancel, and Cancel or Escape hands it back to Delete test.
function CardActions({
  id,
  running,
  onEnd,
  onDelete,
}: {
  id: string;
  running: boolean;
  onEnd: () => void;
  onDelete: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const wasAsking = useRef(false);
  useEffect(() => {
    if (asking) document.getElementById(`exp-${id}-cancel`)?.focus();
    else if (wasAsking.current) document.getElementById(`exp-${id}-delete`)?.focus();
    wasAsking.current = asking;
  }, [asking, id]);
  if (asking)
    return (
      <div
        role="group"
        aria-label={c.confirmDelete}
        onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
        className="flex flex-wrap items-center gap-3 rounded-card border border-brick/30 bg-errorBg px-3 py-2"
      >
        <p className="text-ui font-medium text-brick">{c.confirmDelete}</p>
        <div className="ml-auto flex gap-3">
          <Button
            variant="alt"
            onClick={() => {
              setAsking(false);
              onDelete();
            }}
          >
            {c.remove}
          </Button>
          <Button variant="alt" id={`exp-${id}-cancel`} onClick={() => setAsking(false)}>
            {c.cancel}
          </Button>
        </div>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-3">
      {running && (
        <Button variant="alt" onClick={onEnd}>
          {c.end}
        </Button>
      )}
      <button
        type="button"
        id={`exp-${id}-delete`}
        onClick={() => setAsking(true)}
        className="ml-auto inline-flex min-h-11 items-center text-ui text-text2 underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep md:min-h-8"
      >
        {c.remove}
      </button>
    </div>
  );
}
