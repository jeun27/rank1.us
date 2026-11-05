import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatPercent } from "@/components/ui/StatNumber";
import { Table } from "@/components/ui/Table";
import type { RunSummary } from "@/lib/queries/shell";
import type { Metric } from "@/types/metrics";
import { appCopy as c } from "./copy";
import { Measured, Page } from "./Page";

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "–";
const pct = (m: Metric) => (m.denominator ? Math.floor((m.numerator * 100) / m.denominator) : null);
const link =
  "inline-flex min-h-11 items-center text-jellyDeep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-jellyDeep";

// UI.md 4b History: one row per audit/weekly run, newest first.
export function HistoryView({ runs }: { runs: RunSummary[] }) {
  if (!runs.length)
    return (
      <Page title={c.history}>
        <Card>
          <p className="text-body-lg">{c.noChecks}</p>
        </Card>
      </Page>
    );
  // Change against the next older run that has answers to compare.
  const change = (i: number) => {
    const now = pct(runs[i].visibility);
    const before = runs.slice(i + 1).find((r) => r.status !== "failed" && r.visibility.denominator);
    if (now === null || !before) return "–";
    const d = now - pct(before.visibility)!;
    return `${d > 0 ? "+" : ""}${d} pts`;
  };
  return (
    <Page title={c.history}>
      <Measured checkedAt={null} />
      <Table
        caption={c.history}
        columns={[
          { key: "d", header: c.checked },
          { key: "v", header: c.visibility, numeric: true },
          { key: "c", header: c.change, numeric: true },
        ]}
        rows={runs.map((r, i) => ({
          d: (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link href={`/app/runs/${r.id}`} className={link}>
                <span data-computed>{day(r.finished_at ?? r.started_at)}</span>
              </Link>
              {r.status === "partial" ? (
                <Badge tone="warn">
                  <span data-computed>{`${r.jobs_ok} of ${r.jobs_total} answers`}</span>
                </Badge>
              ) : r.status === "failed" ? (
                <Badge tone="error">{c.failed}</Badge>
              ) : r.status === "complete" ? (
                <Badge tone="success">{c.complete}</Badge>
              ) : null}
              {r.status !== "failed" && (
                <a href={`/app/runs/${r.id}/export.csv`} download className={`${link} text-caption`}>
                  {c.downloadCsv}
                </a>
              )}
            </span>
          ),
          v: (
            <span data-computed>
              {r.visibility.denominator
                ? `${formatPercent(r.visibility)} (named in ${r.visibility.numerator} of ${r.visibility.denominator} answers)`
                : "–"}
            </span>
          ),
          c: <span data-computed>{change(i)}</span>,
        }))}
      />
    </Page>
  );
}
