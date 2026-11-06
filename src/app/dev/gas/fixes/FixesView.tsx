"use client";
import { useId, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EditFlow } from "../EditFlow";
import { FIXES, ORDER_BLOCKERS, ORDER_PLAIN, PILLARS, type Fix, type PillarKey } from "../data";
import type { Query } from "../params";
import { Blocks, Checked, Note, Panel, Picker, Proto, Tag, TextAction } from "../ui";

const STATES = [
  { key: "success", label: "Success" },
  { key: "partial", label: "Partial" },
  { key: "empty", label: "Empty" },
  { key: "loading", label: "Loading" },
  { key: "error", label: "Error" },
];
const VIEWS = [
  { key: "app", label: "Self-serve (/app)" },
  { key: "team", label: "Team (client view)" },
];
const ORDERS = [
  { key: "blockers", label: "Blockers first (Q1)" },
  { key: "plain", label: "P0 to P6" },
];
const STATUS_LABEL = { todo: "To do", doing: "Doing", done: "Done" } as const;

type LogEntry = { at: string; what: string; where: string };

export function FixesView({ q }: { q: Query }) {
  const state = STATES.some((s) => s.key === q.state) ? q.state! : "success";
  const view = q.view === "team" ? "team" : "app";
  const order = q.order === "plain" ? "plain" : "blockers";
  const keep = { state, view, order };
  return (
    <Proto
      title="What to fix next"
      intro="G5. Every fix carries the one pillar it moves. Groups run blockers first: if AI can't read the site (P5), nothing else counts yet. The team view adds the done-for-you edit flow."
      states={STATES}
      state={state}
      extra={
        <div className="flex flex-col gap-3">
          <Picker label="View" param="view" options={VIEWS} value={view} keep={keep} />
          <Picker label="Order" param="order" options={ORDERS} value={order} keep={keep} />
        </div>
      }
    >
      <Body state={state} team={view === "team"} order={order === "plain" ? ORDER_PLAIN : ORDER_BLOCKERS} />
    </Proto>
  );
}

function Body({ state, team, order }: { state: string; team: boolean; order: PillarKey[] }) {
  const [log, setLog] = useState<LogEntry[]>([
    { at: "Oct 28, 2:10 pm", what: "Added 4 photos of the vegan miso ramen", where: "Google Business Profile" },
  ]);
  if (state === "loading") return <Blocks label="Loading fixes" />;
  if (state === "error")
    return (
      <Banner tone="error" action={{ label: "Try again", onClick: () => {} }}>
        We couldn&apos;t load your results. Try again.
      </Banner>
    );
  if (state === "empty")
    return (
      <Panel>
        <p className="text-ui">Nothing to fix yet. Run your first check.</p>
      </Panel>
    );

  const partial = state === "partial";
  const fixes = partial ? FIXES.filter((f) => f.pillar !== "P5") : FIXES;
  const byPillar = (p: PillarKey) =>
    fixes.filter((f) => f.pillar === p).sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const open = (p: PillarKey) => byPillar(p).filter((f) => f.status !== "done").length;

  return (
    <div className="flex flex-col gap-5">
      <Checked>Checked 14 h ago · 250 answers · API-measured, directional</Checked>
      <nav aria-label="Pillars" className="relative -mx-1 overflow-x-auto">
        <ol className="flex gap-1.5 px-1">
          {order.map((p) => (
            <li key={p} className="shrink-0">
              <a
                href={`#${p}`}
                className="flex min-h-11 items-center gap-2 rounded-control border border-border bg-white px-2.5 text-caption hover:bg-raised md:min-h-8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
              >
                <span className="font-mono text-inkMuted">{p}</span>
                {PILLARS[p].short}
                <span className="font-mono tabular-nums">{partial && p === "P5" ? "–" : open(p)}</span>
                <span className="sr-only">to do</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {order.map((p) => (
        <section key={p} id={p} aria-labelledby={`${p}-h`} className="flex scroll-mt-4 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border pb-2">
            <h2 id={`${p}-h`} className="flex items-baseline gap-2 text-[15px] font-medium">
              <span className="font-mono text-caption text-inkMuted">{p}</span>
              {PILLARS[p].label}
            </h2>
            <span className="text-caption text-text2">{PILLARS[p].why}</span>
          </div>
          {p === "P0" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-white px-3 py-2.5">
              <p className="text-caption">
                Your baseline: <span className="font-mono tabular-nums">18%</span> visibility, named in{" "}
                <span className="tabular-nums">45 of 250 answers</span>.
              </p>
              <TextAction href="/dev/app">Open the dashboard</TextAction>
            </div>
          ) : partial && p === "P5" ? (
            <div className="flex flex-col gap-1 rounded-card border border-border bg-white px-3 py-2.5">
              <span className="text-ui font-medium">Can AI see your site?</span>
              <span className="text-caption text-inkMuted">We couldn’t check this yet.</span>
              <span className="text-caption text-text2">Listing and site checks need your website URL</span>
            </div>
          ) : byPillar(p).length === 0 ? (
            <p className="px-1 text-caption text-inkMuted">Nothing to fix here right now.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {byPillar(p).map((f) => (
                <FixCard key={f.id} fix={f} team={team} onApplied={(e) => setLog((l) => [e, ...l])} />
              ))}
            </ul>
          )}
        </section>
      ))}

      {team && (
        <Panel title="Change log">
          <ul className="flex flex-col divide-y divide-border text-caption">
            {log.map((e, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2">
                <span>
                  {e.what} <span className="text-inkMuted">· {e.where}</span>
                </span>
                <span className="font-mono text-inkMuted tabular-nums">{e.at}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {team && (
        <Note>
          Done-for-you edits are always diff → confirm → apply → change log. The client sees the same list with statuses
          only (no edit buttons), and only if &quot;Show fix list to client&quot; is on.
        </Note>
      )}
    </div>
  );
}

function FixCard({ fix, team, onApplied }: { fix: Fix; team: boolean; onApplied: (e: LogEntry) => void }) {
  const id = useId();
  const [status, setStatus] = useState(fix.status);
  const [editing, setEditing] = useState(false);
  const done = status === "done";
  return (
    <li className={`flex flex-col gap-2 rounded-card border border-border bg-white p-3 md:p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 basis-60 text-ui font-medium">{fix.title}</h3>
        {fix.edit && team && <Tag tone="info">We can apply this</Tag>}
      </div>
      <p className="text-caption text-text2">{fix.detail}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-inkMuted tabular-nums">
          {fix.affected !== null ? `${fix.affected} affected answers` : ""}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {team && fix.edit && !editing && !done && (
            <Button variant="alt" onClick={() => setEditing(true)}>
              Review edit
            </Button>
          )}
          <label htmlFor={id} className="text-caption text-inkMuted">
            Status
          </label>
          <select
            id={id}
            value={status}
            onChange={(e) => setStatus(e.target.value as Fix["status"])}
            className="h-11 rounded-control border border-fieldBorder bg-paper px-2 text-caption md:h-8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
          >
            {(["todo", "doing", "done"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {fix.edit && editing && (
        <EditFlow
          where={fix.edit.where}
          before={fix.edit.before}
          after={fix.edit.after}
          mono={fix.edit.where === "robots.txt"}
          onCancel={() => setEditing(false)}
          onApplied={() => {
            setStatus("done");
            onApplied({ at: "Just now", what: fix.title, where: fix.edit!.where });
          }}
        />
      )}
    </li>
  );
}
