"use client";
import { useId, useState } from "react";
import { connectionsCopy as hub } from "@/components/connections/copy";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatAge } from "@/components/ui/Freshness";
import type { Json } from "@/types/db";
import { teamConnectionsCopy as c } from "./team-connections-copy";
import type { TeamConnectionsData } from "./team-connections-data";

export type { TeamConnectionsData };

const STATUS_TONE = { connected: "success", needs_reauth: "warn", revoked: "error" } as const;
const join = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
const name = (k: string) => hub.names[k as keyof typeof hub.names] ?? k;
const value = (v: Json | null) => (v === null ? "–" : typeof v === "string" ? v : JSON.stringify(v));

// C-c PR 1 (lead OK 2026-11-06, D1): the team's Connections document for one DFY client. The G3 notice lives
// only here (lead Q2: the queue shows the tag). No provider calls: everything is stored data.
export function TeamConnections({
  data,
  now,
  onDismiss,
  onStartFixes,
}: {
  data: TeamConnectionsData;
  now: Date;
  onDismiss: () => Promise<{ error: string } | undefined | void>;
  onStartFixes: () => void;
}) {
  const heading = useId();
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const live = data.connections.filter((x) => x.status === "connected").map((x) => name(x.provider));
  const showNotice = data.gas?.showNotice && data.gas.readyAt && !hidden;
  return (
    <div className="flex flex-col gap-6">
      {showNotice && (
        <section
          aria-labelledby={heading}
          className="flex flex-col gap-3 rounded-card border border-moss/30 bg-successBg p-3 md:flex-row md:items-center md:p-4"
        >
          <div className="flex flex-1 flex-col gap-0.5">
            <h3 id={heading} className="text-ui font-semibold text-moss">
              {c.ready(data.business)}
            </h3>
            <p data-computed className="text-caption text-ink">
              {c.connectedAgo(join(live), formatAge(new Date(data.gas!.readyAt!), now))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onStartFixes}>{c.start}</Button>
            <Button
              variant="alt"
              onClick={async () => {
                setHidden(true);
                setFailed(false);
                const r = await Promise.resolve(onDismiss()).catch(() => ({ error: "failed" }));
                if (r && "error" in r) {
                  setHidden(false);
                  setFailed(true);
                }
              }}
            >
              {c.dismiss}
            </Button>
          </div>
        </section>
      )}
      {/* Always present (so it's announced), visually hidden while empty. */}
      <p role="status" className={failed ? "text-caption text-brick" : "sr-only"}>
        {failed ? c.failed : ""}
      </p>

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {data.connections.map((x) => {
          const task =
            x.status === "needs_reauth"
              ? c.reconnect(name(x.provider))
              : x.status === "connected" && !x.selected.length && c.pickNoun[x.provider]
                ? c.choose(c.pickNoun[x.provider])
                : null;
          return (
            <li key={x.id} aria-label={name(x.provider)} className="flex flex-col gap-1 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ui font-medium">{name(x.provider)}</span>
                <Badge tone={STATUS_TONE[x.status]}>{hub.statuses[x.status]}</Badge>
              </div>
              {x.selected.length > 0 && (
                <p data-computed className="text-caption text-text2">
                  {x.selected.map((s) => s.name).join(", ")}
                </p>
              )}
              {task && (
                <p data-testid="task" className="text-caption">
                  {task}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {data.interest.length > 0 && (
        <p className="text-caption text-text2">{c.interest(join(data.interest.map(name)))}</p>
      )}

      {data.changes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-ui font-semibold">{c.changes}</h3>
          <ul aria-label={c.changes} className="flex flex-col divide-y divide-border border-y border-border">
            {data.changes.map((x) => (
              <li key={x.id} className="flex flex-col gap-1 py-2">
                <span className="text-ui font-medium">{hub.fields[x.field as keyof typeof hub.fields] ?? x.field}</span>
                <span className="text-caption break-words text-text2">
                  {c.before}: {value(x.before)}
                </span>
                <span className="text-caption break-words">
                  {c.after}: {value(x.after)}
                </span>
                <span className="text-caption text-inkMuted">
                  {x.by.kind === "team" ? c.byTeam : x.by.kind === "client" ? c.by(x.by.email) : c.byFormer} ·{" "}
                  <span data-computed className="font-mono">
                    {x.at.slice(0, 10)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
