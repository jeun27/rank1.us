import { useId } from "react";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { formatPercent } from "@/components/ui/StatNumber";
import { demoBoard, demoEngines, demoQuestion, demoThisWeek } from "@/components/site/demo-data";
import { copy, welcome as w } from "./copy";

// UI1 (O1): what the first check will show, built from the landing demo fixture (invented, labelled Example
// data). The You row reads "Your business" (OC10) and every % carries its n.
export function ExamplePanel() {
  const n = (m: { numerator: number; denominator: number }) => (
    <span className="text-inkMuted">{` ${m.numerator} of ${m.denominator}`}</span>
  );
  const board = demoBoard(demoThisWeek);
  const titleId = useId();
  return (
    // A labelled figure, not a landmark region: it illustrates the step, it is not a place to navigate to.
    <figure aria-labelledby={titleId} className="self-start rounded-surface border border-border bg-white p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <p id={titleId} className="text-ui font-medium text-ink">
          {w.exampleTitle}
        </p>
        <Badge tone="info">{copy.exampleData}</Badge>
      </div>
      <p className="mt-2 text-caption text-text2">
        {w.forQuestion} <span className="font-mono">{demoQuestion}</span>
      </p>
      {/* The panel's dense size: cells inherit text-ui, with shorter rows than a full page table. */}
      <div className="mt-3 text-ui [&_td]:py-2.5">
        <Table
          caption={w.exampleTitle}
          stack
          pin={(i) => board[i].you}
          columns={[
            { key: "brand", header: w.whoNames },
            { key: "named", header: w.namedIn, numeric: true },
          ]}
          rows={board.map((r) => ({
            brand: r.you ? (
              <span className="inline-flex items-center gap-2">
                {w.you}
                <Badge tone="info">{w.youTag}</Badge>
              </span>
            ) : (
              r.brand
            ),
            named: (
              <span className="font-mono tabular-nums">
                {formatPercent(r.named)}
                {n(r.named)}
              </span>
            ),
          }))}
        />
      </div>
      <ul className="mt-4 flex flex-col gap-2.5">
        {demoEngines.map((e) => (
          <li key={e.engine} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-caption">
            <span className="text-text2">{e.engine}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-overlay">
              <span
                className="block h-full origin-left rounded-full bg-accent"
                style={{ transform: `scaleX(${e.named.value ?? 0})` }}
              />
            </span>
            <span className="font-mono text-text2 tabular-nums">{`${e.named.numerator} of ${e.named.denominator}`}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption text-inkMuted">{w.footnote}</p>
    </figure>
  );
}
