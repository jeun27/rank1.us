"use client";
import { useEffect, useState, type KeyboardEvent } from "react";
import { rovingIndex } from "@/components/workspace/hooks";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import type { FixItem, FixStatus } from "@/lib/queries/fixes";
import { fixCopy as c } from "./copy";

// Who changed a status, as backend returns it (#101): the team is { is_team: true, name: null }; a member
// is their display name. Never an email.
export type Actor = { is_team: boolean; name: string | null };
// The customer-facing fields only: never why_note, evidence JSON, size or data_source.
export type FixView = Pick<FixItem, "id" | "rule_key" | "title" | "detail" | "affected_answers" | "status"> & {
  status_changed_at?: string | null;
  changed_by?: Actor | null;
};
// listDoneFixes (#101), newest change first.
export type DoneView = {
  id: string;
  rule_key: string;
  title: string;
  detail: string | null;
  status_changed_at: string | null;
  changed_by: Actor | null;
};
type OnStatus = (id: string, status: FixStatus) => Promise<{ error: string } | undefined | void>;
type Row = {
  id: string;
  title: string;
  detail: string | null;
  affected: number | null;
  at: string | null;
  by: Actor | null;
};

const FILTERS = ["open", "done", "all"] as const;
type Filter = (typeof FILTERS)[number];
const TOAST_MS = 8000;
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(
    new Date(iso),
  );
const who = (a: Actor | null) => (!a ? null : a.is_team ? c.rankTeam : a.name);
const joined = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";
const control = `inline-flex h-11 shrink-0 items-center rounded-control border border-fieldBorder bg-raised px-3 text-ui font-medium text-ink hover:bg-overlay md:h-8 ${focus}`;

// The check-off circle: empty (to do), half (in progress), checked (done).
function Mark({ state }: { state: FixStatus }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <circle
        cx="10"
        cy="10"
        r="8.5"
        fill={state === "done" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {state === "doing" && <path d="M10 1.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />}
      {state === "done" && (
        <path
          d="m6 10.2 2.6 2.6L14 7.4"
          fill="none"
          stroke="var(--color-paper)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function FixRow({
  row,
  state,
  canWrite,
  level,
  onDone,
  onStart,
  onReopen,
}: {
  row: Row;
  state: FixStatus;
  canWrite: boolean;
  level: 2 | 3 | 4;
  onDone: () => void;
  onStart: () => void;
  onReopen: () => void;
}) {
  const Heading = (["h2", "h3", "h4"] as const)[level - 2];
  const done = state === "done";
  const onKey = (e: KeyboardEvent) => {
    if (!canWrite || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "x" && !done) onDone();
    else if (e.key === "s" && state === "todo") onStart();
    else return;
    e.preventDefault();
  };
  return (
    <li onKeyDown={onKey} className="flex gap-3 rounded-card border border-border bg-white p-4 md:p-5">
      {canWrite ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={done ? "true" : state === "doing" ? "mixed" : "false"}
          aria-label={row.title}
          aria-keyshortcuts="x"
          title={c.markDoneTip}
          onClick={done ? onReopen : onDone}
          className={`-m-2 grid size-11 shrink-0 place-items-center rounded-full text-ink md:size-9 ${focus}`}
        >
          <Mark state={state} />
        </button>
      ) : (
        <span role="img" aria-label={`${row.title}: ${c.statuses[state]}`} className="text-ink">
          <Mark state={state} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Heading data-computed className={`text-ui font-semibold ${done ? "text-inkMuted line-through" : ""}`}>
          {row.title}
        </Heading>
        {row.detail && (
          <p data-computed className={`text-ui ${done ? "text-inkMuted" : ""}`}>
            {row.detail}
          </p>
        )}
        {row.affected !== null && !done && (
          <p data-computed className="text-caption text-inkMuted tabular-nums">
            {c.affected(row.affected)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {state === "doing" && (
            <p className="flex items-center gap-2 text-caption">
              <span aria-hidden className="size-1.5 rounded-full bg-ink" />
              <span className="font-medium">{c.inProgress}</span>
              {(row.by || row.at) && (
                <span data-computed className="text-inkMuted">
                  {joined(who(row.by), row.at ? day(row.at) : null)}
                </span>
              )}
            </p>
          )}
          {done && (
            <p data-computed className="text-caption text-inkMuted">
              {joined(row.at ? c.doneOn(day(row.at)) : c.doneTab, who(row.by))}
            </p>
          )}
          {canWrite && state === "todo" && (
            <button type="button" aria-keyshortcuts="s" title={c.startTip} onClick={onStart} className={control}>
              {c.start}
            </button>
          )}
          {canWrite && done && (
            <button type="button" onClick={onReopen} className={control}>
              {c.undo}
            </button>
          )}
          {canWrite && !done && (
            <a
              href={`/app/experiments/new?fix=${encodeURIComponent(row.id)}`}
              className="inline-flex min-h-11 items-center text-ui text-jellyDeep underline-offset-4 hover:underline md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
            >
              {c.startTest}
            </a>
          )}
          {/* G5: the pillar tag (P0-P6) goes here once fixes.pillar lands. */}
        </div>
      </div>
    </li>
  );
}

const fromOpen = (f: FixView): Row => ({
  id: f.id,
  title: f.title,
  detail: f.detail,
  affected: f.affected_answers,
  at: f.status_changed_at ?? null,
  by: f.changed_by ?? null,
});
const fromDone = (f: DoneView): Row => ({
  id: f.id,
  title: f.title,
  detail: f.detail,
  affected: null,
  at: f.status_changed_at,
  by: f.changed_by,
});

// UI.md 4b Fix list as a check-off list (portal b), shared by /app (self-serve), the team area and DFY
// clients. The DB keeps todo / doing / done (set_fix_status); clients see the circles as status only.
export function FixList({
  ranked,
  tidyUps,
  done = [],
  unchecked,
  noDomain,
  canWrite,
  onStatus,
  level = 2,
}: {
  ranked: FixView[];
  tidyUps: FixView[];
  done?: DoneView[];
  unchecked: { rule_key: string; title: string }[];
  noDomain: boolean;
  canWrite: boolean;
  onStatus?: OnStatus;
  // The heading level of the ranked cards and of "Tidy-ups": 2 on a page, 3 inside a workspace document.
  level?: 2 | 3;
}) {
  const [statuses, setStatuses] = useState<Record<string, FixStatus>>({});
  const [doneAt, setDoneAt] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [toast, setToast] = useState<{ id: string; title: string; prev: FixStatus } | null>(null);
  const write = canWrite && Boolean(onStatus);
  const TidyHeading = level === 2 ? "h2" : "h3";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  if (!ranked.length && !tidyUps.length && !unchecked.length && !done.length)
    return (
      <Card>
        <p className="text-body-lg">{c.empty}</p>
      </Card>
    );

  const stateOf = (id: string, base: FixStatus) => statuses[id] ?? base;
  // Optimistic: the row changes now and goes back if the save is refused.
  const set = async (id: string, next: FixStatus, prev: FixStatus) => {
    setFailed(false);
    setStatuses((s) => ({ ...s, [id]: next }));
    if (next === "done") setDoneAt((d) => ({ ...d, [id]: new Date().toISOString() }));
    const r = await Promise.resolve()
      .then(() => onStatus!(id, next))
      .catch(() => ({ error: "failed" }));
    if (r && "error" in r) {
      setStatuses((s) => ({ ...s, [id]: prev }));
      setFailed(true);
      return false;
    }
    return true;
  };
  const markDone = async (id: string, title: string, prev: FixStatus) => {
    if (await set(id, "done", prev)) setToast({ id, title, prev });
  };

  const openRows = (list: FixView[]) => list.filter((f) => stateOf(f.id, f.status) !== "done");
  // A done fix reopened here joins the ranked group until the next load.
  const reopened = done.filter((f) => stateOf(f.id, "done") !== "done");
  const rankedOpen = [
    ...openRows(ranked),
    ...reopened.map((f) => ({ ...f, affected_answers: null, status: "todo" as const })),
  ];
  const tidyOpen = openRows(tidyUps);
  const doneRows: Row[] = [
    ...[...ranked, ...tidyUps]
      .filter((f) => stateOf(f.id, f.status) === "done")
      .map((f) => ({ ...fromOpen(f), at: doneAt[f.id] ?? null, by: null })),
    ...done.filter((f) => stateOf(f.id, "done") === "done").map(fromDone),
  ];
  const total = ranked.length + tidyUps.length + done.length;
  const openCount = rankedOpen.length + tidyOpen.length;

  const renderOpen = (f: FixView, lvl: 2 | 3 | 4) => {
    const state = stateOf(f.id, f.status);
    return (
      <FixRow
        key={f.id}
        row={fromOpen(f)}
        state={state}
        canWrite={write}
        level={lvl}
        onDone={() => markDone(f.id, f.title, state)}
        onStart={() => set(f.id, "doing", state)}
        onReopen={() => set(f.id, "todo", "done")}
      />
    );
  };
  const showOpen = filter !== "done";
  const showDone = filter !== "open";
  const labels: Record<Filter, string> = { open: c.open, done: c.doneTab, all: c.all };
  const counts: Record<Filter, number | null> = { open: openCount, done: doneRows.length, all: null };

  return (
    <div className="flex flex-col gap-6">
      {failed && <Banner tone="error">{c.saveFailed}</Banner>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={c.progress(doneRows.length, total)}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={doneRows.length}
            className="h-1.5 w-40 overflow-hidden rounded-full bg-overlay md:w-56"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-accent"
              style={{ transform: `scaleX(${total ? doneRows.length / total : 0})` }}
            />
          </div>
          <span data-computed className="font-mono text-caption text-text2 tabular-nums">
            {c.progress(doneRows.length, total)}
          </span>
        </div>
        {/* A segmented control (UI.md), not tabs: the team workspace already wraps this in a document tabpanel. */}
        <div
          role="radiogroup"
          aria-label={c.title}
          className="flex rounded-control border border-border bg-paper p-0.5"
        >
          {FILTERS.map((f, i) => (
            <button
              key={f}
              id={`fix-filter-${f}`}
              type="button"
              role="radio"
              aria-checked={filter === f}
              tabIndex={filter === f ? 0 : -1}
              onClick={() => setFilter(f)}
              onKeyDown={(e) => {
                const j = rovingIndex(e, i, FILTERS.length);
                if (j === null) return;
                setFilter(FILTERS[j]);
                document.getElementById(`fix-filter-${FILTERS[j]}`)?.focus();
              }}
              className={`inline-flex h-11 items-center gap-2 rounded-control px-3 text-caption font-medium md:h-7 ${focus} ${
                filter === f ? "bg-overlay text-ink" : "text-inkMuted hover:text-ink"
              }`}
            >
              {labels[f]}
              {counts[f] !== null && (
                <span data-computed className="font-mono tabular-nums">
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {showOpen && rankedOpen.length > 0 && (
        <ul aria-label={c.title} className="flex flex-col gap-3">
          {rankedOpen.map((f) => renderOpen(f, level))}
        </ul>
      )}
      {showOpen && unchecked.length > 0 && (
        <div className="flex flex-col gap-3">
          {noDomain && <p className="text-ui">{c.noDomain}</p>}
          <ul className="flex flex-col gap-2">
            {unchecked.map((u) => (
              <li key={u.rule_key} className="flex flex-col gap-1 rounded-card border border-border bg-white px-4 py-3">
                <span data-computed className="text-ui font-semibold">
                  {u.title}
                </span>
                <span className="text-caption text-inkMuted">{c.unchecked}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showOpen && tidyOpen.length > 0 && (
        <section aria-label={c.tidyUps} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <TidyHeading className="font-display text-h3 font-semibold">{c.tidyUps}</TidyHeading>
            <span data-testid="group-count" data-computed className="font-mono text-caption text-inkMuted tabular-nums">
              {tidyOpen.length}
            </span>
          </div>
          <ul className="flex flex-col gap-3">{tidyOpen.map((f) => renderOpen(f, level === 2 ? 3 : 4))}</ul>
        </section>
      )}
      {showDone && doneRows.length > 0 && (
        <section aria-label={c.doneTab} className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {doneRows.map((r) => (
              <FixRow
                key={r.id}
                row={r}
                state="done"
                canWrite={write}
                level={level}
                onDone={() => {}}
                onStart={() => {}}
                onReopen={() => set(r.id, "todo", "done")}
              />
            ))}
          </ul>
        </section>
      )}

      {toast && (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-4 rounded-card border border-border bg-overlay px-4 py-3 text-ui shadow-overlay"
        >
          <span data-computed>{c.marked(toast.title)}</span>
          <button
            type="button"
            onClick={async () => {
              const t = toast;
              setToast(null);
              await set(t.id, t.prev, "done");
            }}
            className={`text-ui font-medium text-ink underline underline-offset-4 ${focus}`}
          >
            {c.undo}
          </button>
        </div>
      )}
    </div>
  );
}
