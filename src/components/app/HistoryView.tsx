import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { VisibilityCell } from "@/components/ui/StatNumber";
import { Table } from "@/components/ui/Table";
import { floorPct } from "@/lib/metrics/compute";
import type { RunSummary } from "@/lib/queries/shell";
import { appCopy as c } from "./copy";
import { Measured, Page } from "./Page";
import { signedPts } from "@/lib/metrics/delta";

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "–";
const pct = floorPct;
const link =
  "inline-flex min-h-11 items-center text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep";

// One row per audit/weekly run, newest first. linked: the run page and CSV links (members of the
// workspace in /app); the DFY client view has neither (Step 12).
export function HistoryTable({ runs, linked = true }: { runs: RunSummary[]; linked?: boolean }) {
  // Change against the next older run that has answers to compare.
  const change = (i: number) => {
    const now = pct(runs[i].visibility);
    const before = runs.slice(i + 1).find((r) => r.status !== "failed" && r.visibility.denominator);
    if (now === null || !before) return "–";
    const d = now - pct(before.visibility)!;
    return signedPts(d);
  };
  return (
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
            {linked ? (
              <Link href={`/app/runs/${r.id}`} className={link}>
                <span data-computed>{day(r.finished_at ?? r.started_at)}</span>
              </Link>
            ) : (
              <span data-computed className="inline-flex min-h-11 items-center">
                {day(r.finished_at ?? r.started_at)}
              </span>
            )}
            {r.status === "partial" ? (
              <Badge tone="warn">
                <span data-computed>{`${r.jobs_ok} of ${r.jobs_total} answers`}</span>
              </Badge>
            ) : r.status === "failed" ? (
              <Badge tone="error">{c.failed}</Badge>
            ) : r.status === "complete" ? (
              <Badge tone="success">{c.complete}</Badge>
            ) : null}
            {linked && r.status !== "failed" && (
              <a href={`/app/runs/${r.id}/export.csv`} download className={`${link} text-caption`}>
                {c.downloadCsv}
              </a>
            )}
          </span>
        ),
        v: r.visibility.denominator ? <VisibilityCell metric={r.visibility} /> : <span data-computed>–</span>,
        c: <span data-computed>{change(i)}</span>,
      }))}
    />
  );
}

// UI.md 4b History.
export function HistoryView({ runs }: { runs: RunSummary[] }) {
  if (!runs.length)
    return (
      <Page title={c.history}>
        <Card>
          {/* X25: History lists every run status, so empty means none is queued yet. */}
          <EmptyState message={c.noChecks} action={{ label: c.reviewQuestions, href: "/app/questions" }} />
        </Card>
      </Page>
    );
  return (
    <Page title={c.history}>
      <Measured checkedAt={null} />
      <HistoryTable runs={runs} />
    </Page>
  );
}
