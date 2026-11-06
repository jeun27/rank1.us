"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Jelly } from "@/components/ui/Jelly";
import { BUSINESS } from "../data";
import type { Query } from "../params";
import { Note, Panel, Proto, Status, Tag, TextAction } from "../ui";

const STATES = [
  { key: "client-waiting", label: "Client: 1 of 2 connected" },
  { key: "client-ready", label: "Client: all set" },
  { key: "team-notice", label: "Team: ready notice" },
  { key: "attention", label: "Needs attention again" },
];

type Conn = { name: string; on: boolean };
const conns = (all: boolean, lost = false): Conn[] => [
  { name: "Google Business Profile", on: true },
  { name: "Search Console", on: all && !lost },
];

export function ReadyView({ q }: { q: Query }) {
  const state = STATES.some((s) => s.key === q.state) ? q.state! : "client-waiting";
  return (
    <Proto
      title="Ready for GAS"
      intro="G3. When a client connects every Recommended connection, they see one calm card and the team gets one notice. If a connection drops later, both sides see it again. The notice shows in-app (Q2); the email destination is still TBD."
      states={STATES}
      state={state}
    >
      {state === "client-waiting" && <ClientCard ready={false} />}
      {state === "client-ready" && <ClientCard ready />}
      {state === "team-notice" && <Team attention={false} />}
      {state === "attention" && (
        <div className="flex flex-col gap-4">
          <Attention />
          <Team attention />
        </div>
      )}
    </Proto>
  );
}

function ConnList({ list }: { list: Conn[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
      {list.map((c) => (
        <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-caption">
          <span className="font-medium">{c.name}</span>
          {c.on ? <Status tone="success">Connected</Status> : <Button variant="alt">{`Connect ${c.name}`}</Button>}
        </li>
      ))}
    </ul>
  );
}

function ClientCard({ ready }: { ready: boolean }) {
  const list = conns(ready);
  const n = list.filter((c) => c.on).length;
  if (ready)
    return (
      <Panel>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Jelly size={56} />
          <div className="flex flex-1 flex-col gap-1">
            <h2 className="text-[15px] font-medium">You&apos;re all set. We&apos;ll take it from here.</h2>
            <p className="text-caption text-text2">
              Business Profile and Search Console are connected. Your team starts on your fix list this week, and every
              change shows in your change log.
            </p>
          </div>
          <TextAction href="/dev/gas/fixes?view=app">See your fix list</TextAction>
        </div>
        <ConnList list={list} />
      </Panel>
    );
  return (
    <Panel
      title="Connect your accounts"
      aside={
        <span className="text-caption text-inkMuted tabular-nums">
          <span className="font-mono">{n}</span> of <span className="font-mono">{list.length}</span> connected
        </span>
      }
    >
      <p className="text-caption text-text2">
        One click each, with Google&apos;s own sign-in. We never see your password, and you can disconnect any time.
      </p>
      <div
        role="progressbar"
        aria-label={`${n} of ${list.length} connected`}
        aria-valuemin={0}
        aria-valuemax={list.length}
        aria-valuenow={n}
        className="h-1.5 overflow-hidden rounded-full bg-overlay"
      >
        <div
          className="h-full origin-left rounded-full bg-accent"
          style={{ transform: `scaleX(${n / list.length})` }}
        />
      </div>
      <ConnList list={list} />
    </Panel>
  );
}

const CLIENTS = [
  { name: BUSINESS.name, state: "ready" as const, note: "Business Profile + Search Console connected" },
  { name: "Example Taco Stand", state: "waiting" as const, note: "1 of 2 connected" },
  { name: "Example Pho Spot", state: "working" as const, note: "Fix list started Oct 30" },
];

function Team({ attention }: { attention: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [started, setStarted] = useState(false);
  const rows = attention
    ? CLIENTS.map((c) =>
        c.name === BUSINESS.name ? { ...c, state: "attention" as const, note: "Search Console disconnected" } : c,
      )
    : CLIENTS;
  return (
    <div className="flex flex-col gap-4">
      {!attention && !dismissed && (
        <section
          aria-labelledby="notice-h"
          className="flex flex-col gap-3 rounded-card border border-moss/30 bg-successBg p-3 md:flex-row md:items-center md:p-4"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-moss">
            <Icon name="dashboard" className="size-4" />
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <h2 id="notice-h" className="text-[13px] font-medium text-moss">
              {started ? `Started: ${BUSINESS.name}` : `${BUSINESS.name} is ready for GAS`}
            </h2>
            <p className="text-caption text-ink">
              Business Profile + Search Console connected 12 min ago. Their fix list has 2 blockers to start with.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!started && <Button onClick={() => setStarted(true)}>Start on the fix list</Button>}
            <Button variant="alt" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          </div>
        </section>
      )}
      <Panel title="Clients">
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((c) => (
            <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="flex min-w-0 flex-col">
                <span className="text-ui font-medium">{c.name}</span>
                <span className="text-caption text-inkMuted">{c.note}</span>
              </span>
              {c.state === "ready" && <Tag tone="success">Ready for GAS</Tag>}
              {c.state === "waiting" && <Tag tone="warn">Waiting on client</Tag>}
              {c.state === "working" && <Tag tone="info">In progress</Tag>}
              {c.state === "attention" && <Tag tone="error">Needs attention</Tag>}
            </li>
          ))}
        </ul>
      </Panel>
      <Note>
        Q2: in-app only for now (this notice + the badge in the /team client list). Email goes to a destination you pick
        later (hello@, your inbox or Slack). One notice per client, sent once; it comes back only after a connection
        drops and is fixed again.
      </Note>
    </div>
  );
}

function Attention() {
  return (
    <Panel>
      <div className="flex flex-col gap-3 rounded-card border border-warnText/25 bg-warnBg p-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-0.5">
          <h2 className="text-[13px] font-medium text-warnText">Search Console stopped sharing data</h2>
          <p className="text-caption text-ink">
            Reconnect it so we can keep tracking the questions people search. Nothing else changed.
          </p>
        </div>
        <Button>Reconnect Search Console</Button>
      </div>
      <p className="text-caption text-inkMuted">What the client sees on their dashboard.</p>
    </Panel>
  );
}
