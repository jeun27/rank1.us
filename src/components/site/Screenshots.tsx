import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Freshness } from "@/components/ui/Freshness";
import { formatPercent, StatNumber } from "@/components/ui/StatNumber";
import { Table } from "@/components/ui/Table";
import type { Metric } from "@/types/metrics";
import { exampleAuditRows, exampleCheck, exampleEngines, exampleLeaderboard, pointsChange } from "./example-data";
import { ScreenshotTabs } from "./ScreenshotTabs";
import { Section } from "./Section";

// Fixture values are data, not copy: data-computed tells the COPY.md e2e check to skip them.
const Data = ({ children }: { children: string }) => <span data-computed>{children}</span>;
// Percent with its sample size on a caption line below.
const pct = (m: Metric) => (
  <span data-computed className="flex flex-col">
    <span>{formatPercent(m)}</span>
    <span className="text-caption text-inkMuted">{`${m.numerator} of ${m.denominator}`}</span>
  </span>
);
const freshness = (
  <Freshness checkedAt={exampleCheck.checkedAt} now={exampleCheck.now} answers={exampleCheck.answers} />
);

const you = exampleLeaderboard.find((r) => r.you)!;

function Dashboard() {
  const rows = [...exampleLeaderboard].sort((a, b) => b.now.numerator - a.now.numerator);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-4" data-computed>
        <StatNumber metric={you.now} />
        <p className="pb-5 font-semibold text-moss tabular-nums">{pointsChange(you.now, you.lastWeek)}</p>
      </div>
      <Table
        caption="Example data"
        columns={[
          { key: "business", header: "Business" },
          { key: "visibility", header: "Visibility", numeric: true },
          { key: "change", header: "Change", numeric: true },
        ]}
        rows={rows.map((r) => ({
          business: (
            <span className="inline-flex items-center gap-2">
              <Data>{r.brand}</Data>
              {r.you && <Badge tone="info">You</Badge>}
            </span>
          ),
          visibility: pct(r.now),
          change: <Data>{pointsChange(r.now, r.lastWeek)}</Data>,
        }))}
        footnote={freshness}
      />
    </div>
  );
}

function MonthlyReport() {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-h3 font-semibold">
        <Data>{you.brand}</Data>
      </h3>
      <Table
        caption="Example data"
        columns={[
          { key: "engine", header: "Engine" },
          { key: "visibility", header: "Visibility", numeric: true },
          { key: "change", header: "Change", numeric: true },
        ]}
        rows={exampleEngines.map((e) => ({
          engine: <Data>{e.engine}</Data>,
          visibility: pct(e.now),
          change: <Data>{pointsChange(e.now, e.lastWeek)}</Data>,
        }))}
        footnote={freshness}
      />
    </div>
  );
}

function AuditCsv() {
  return (
    <Table
      caption="Example data"
      columns={[
        { key: "question", header: "Question" },
        { key: "engine", header: "Engine" },
        { key: "named", header: "Named", numeric: true },
      ]}
      rows={exampleAuditRows.map((r) => ({
        question: <Data>{r.question}</Data>,
        engine: <Data>{r.engine}</Data>,
        named: <Data>{`${r.named.numerator} of ${r.named.denominator}`}</Data>,
      }))}
      footnote={freshness}
    />
  );
}

export function Screenshots() {
  return (
    <Section id="screenshots" title="What you see on Monday.">
      <div className="mb-4">
        <Badge tone="info">Example data</Badge>
      </div>
      <ScreenshotTabs
        labelledBy="screenshots-title"
        tabs={[
          { label: "Dashboard", panel: <Dashboard /> },
          { label: "Monthly report", panel: <MonthlyReport /> },
          { label: "Audit CSV", panel: <AuditCsv /> },
        ]}
      />
      <div className="mt-8">
        <Button variant="secondary" href="#audit">
          Get my free audit
        </Button>
      </div>
    </Section>
  );
}
