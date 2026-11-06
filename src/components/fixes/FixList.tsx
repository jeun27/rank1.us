"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { rovingIndex } from "@/components/workspace/hooks";
import { Banner } from "@/components/ui/Banner";
import { FirstCheckEmpty } from "@/components/app/FirstCheckEmpty";
import { Card } from "@/components/ui/Card";
import type { FirstCheck } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PILLAR_ORDER, type FixItem, type FixStatus, type Pillar } from "@/lib/queries/fixes";
import type { Metric } from "@/types/metrics";
import { fixCopy as c } from "./copy";

// Who changed a status, as backend returns it (#101): the team is { is_team: true, name: null }; a member
// is their display name. Never an email.
export type Actor = { is_team: boolean; name: string | null };
// The customer-facing fields only: never why_note, evidence JSON, size or data_source.
export type FixView = Pick<FixItem, "id" | "rule_key" | "title" | "detail" | "affected_answers" | "status"> & {
  status_changed_at?: string | null;
  changed_by?: Actor | null;
  // G5 (#102): the fix's pillar. Real fixes always have one; older fixtures don't (plain sections then).
  pillar?: Pillar;
  // G2: the evidence the page attaches (the AI access panel on R14, R16 and R18), in the open fix's collapsible body (X7).
  evidence?: ReactNode;
};
// listDoneFixes (#101), newest change first.
export type DoneView = {
  id: string;
  rule_key: string;
  title: string;
  detail: string | null;
  status_changed_at: string | null;
  changed_by: Actor | null;
  // Not in done_fixes yet (lead Q4); a done fix without one counts toward no group.
  pillar?: Pillar;
};
type OnStatus = (id: string, status: FixStatus) => Promise<{ error: string } | undefined | void>;
type Row = {
  id: string;
  title: string;
  detail: string | null;
  affected: number | null;
  at: string | null;
  by: Actor | null;
  pillar?: Pillar;
  evidence?: ReactNode;
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
// "In progress · Rank1 team · Nov 5" / "Done Nov 4 · Ana": who moved a fix and when (/client, X3).
export const statusLine = (state: "doing" | "done", at: string | null, by: Actor | null) =>
  state === "doing"
    ? joined(c.inProgress, who(by), at ? day(at) : null)
    : joined(at ? c.doneOn(day(at)) : c.doneTab, who(by));
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";
const control = `inline-flex h-11 shrink-0 items-center rounded-control border border-fieldBorder bg-raised px-3 text-ui font-medium text-ink hover:bg-overlay md:h-8 ${focus}`;

// The check-off circle: empty (to do), half (in progress), checked (done). The Dashboard card reuses it.
export function Mark({ state }: { state: FixStatus }) {
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
  expanded,
  onToggle,
}: {
  row: Row;
  state: FixStatus;
  canWrite: boolean;
  level: 2 | 3 | 4;
  onDone: () => void;
  onStart: () => void;
  onReopen: () => void;
  // X7: one line (check-off, title, affected) until opened; open = the full card.
  expanded: boolean;
  onToggle: () => void;
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
    <li
      id={`fix-${row.id}`}
      onKeyDown={onKey}
      className={`flex gap-3 ${
        expanded
          ? "my-1 rounded-card border border-border bg-white p-4 md:p-5"
          : "items-center border-b border-border px-1 py-1 max-md:flex-wrap"
      }`}
    >
      {canWrite ? (
        <button
          type="button"
          role="checkbox"
          data-fix-check={row.id}
          data-computed
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
        <span role="img" data-computed aria-label={`${row.title}: ${c.statuses[state]}`} className="text-ink">
          <Mark state={state} />
        </span>
      )}
      <div className={`flex min-w-0 flex-1 gap-2 ${expanded ? "flex-col" : "items-center max-md:flex-wrap"}`}>
        <Heading
          data-computed
          className={`min-w-0 flex-1 text-ui font-semibold ${done ? "text-inkMuted line-through" : ""}`}
        >
          <button
            type="button"
            id={`fix-${row.id}-title`}
            aria-expanded={expanded}
            aria-controls={`fix-${row.id}-body`}
            onClick={onToggle}
            className={`flex min-h-11 w-full items-center gap-2 text-left md:min-h-10 ${expanded ? "md:min-h-0" : ""} ${focus}`}
          >
            <span className="min-w-0 flex-1">{row.title}</span>
            <Icon
              name="chevronRight"
              className={`size-4 shrink-0 text-inkMuted transition-transform motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        </Heading>
        {!expanded && row.affected !== null && !done && (
          <p data-computed className="shrink-0 text-caption text-inkMuted tabular-nums">
            {c.affected(row.affected)}
          </p>
        )}
        <div id={`fix-${row.id}-body`} hidden={!expanded} className="flex flex-col gap-2">
          {row.detail && (
            <p data-computed className={`text-ui ${done ? "text-inkMuted" : ""}`}>
              {row.detail}
            </p>
          )}
          {row.evidence && !done && <div className="rounded-card border border-border p-3">{row.evidence}</div>}
          {expanded && row.affected !== null && !done && (
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
            {canWrite && done && <TestLink id={row.id} />}
          </div>
        </div>
      </div>
    </li>
  );
}

// X27: a before/after test needs a change to test, so it's offered once a fix is done (toast, done rows).
function TestLink({ id }: { id: string }) {
  return (
    <a
      href={`/app/experiments/new?fix=${encodeURIComponent(id)}`}
      className="inline-flex min-h-11 items-center text-ui text-link underline underline-offset-4 md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
    >
      {c.startTest}
    </a>
  );
}

// X7: the fix open on load, the first open one in display order (the Dashboard card shows the same one).
function firstOpen(ranked: FixView[], tidyUps: FixView[]): string | undefined {
  if (![...ranked, ...tidyUps].some((f) => f.pillar)) return (ranked[0] ?? tidyUps[0])?.id;
  for (const p of PILLAR_ORDER) {
    const first = ranked.find((f) => f.pillar === p) ?? (p === "p2" ? tidyUps[0] : undefined);
    if (first) return first.id;
  }
}

// The fix a #fix-{id} link points at ("" on the server and before hydration).
const onHash = (cb: () => void) => (
  window.addEventListener("hashchange", cb),
  () => window.removeEventListener("hashchange", cb)
);
const hashFix = () => window.location.hash.match(/^#fix-(.+)$/)?.[1] ?? "";

const fromOpen = (f: FixView): Row => ({
  id: f.id,
  title: f.title,
  detail: f.detail,
  affected: f.affected_answers,
  at: f.status_changed_at ?? null,
  by: f.changed_by ?? null,
  pillar: f.pillar,
  evidence: f.evidence,
});
const fromDone = (f: DoneView): Row => ({
  id: f.id,
  title: f.title,
  detail: f.detail,
  affected: null,
  at: f.status_changed_at,
  by: f.changed_by,
  pillar: f.pillar,
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
  baseline = null,
  baselineHref,
  firstCheck,
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
  // G5 P0: the latest visibility, shown as one baseline line at the bottom (none without a run).
  baseline?: Metric | null;
  baselineHref?: string;
  // X25: set when there's no run yet (queued/running or not), so the empty list says what happens next.
  firstCheck?: FirstCheck;
}) {
  const [statuses, setStatuses] = useState<Record<string, FixStatus>>({});
  const root = useRef<HTMLDivElement>(null);
  const [doneAt, setDoneAt] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [toast, setToast] = useState<{ id: string; title: string; prev: FixStatus } | null>(null);
  // WCAG 2.2.1: focus or hover on the toast pauses its timer; leaving restarts the full 8 s.
  const [held, setHeld] = useState({ focus: false, hover: false });
  // Open by default: the first open fix and the #fix-{id} target. A click flips a row from its default.
  const first = firstOpen(ranked, tidyUps);
  const target = useSyncExternalStore(onHash, hashFix, () => "");
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const isOpen = (id: string) => (id === first || id === target) !== flipped.has(id);
  const toggle = (id: string) =>
    setFlipped((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const write = canWrite && Boolean(onStatus);
  const TidyHeading = level === 2 ? "h2" : "h3";

  // The Dashboard card links to #fix-{id}: bring that fix into view and focus its title.
  useEffect(() => {
    const title = target && document.getElementById(`fix-${target}-title`);
    if (!title) return;
    title.scrollIntoView({ block: "center" });
    title.focus();
  }, [target]);

  useEffect(() => {
    if (!toast || held.focus || held.hover) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, held.focus, held.hover]);

  if (!ranked.length && !tidyUps.length && !unchecked.length && !done.length)
    return (
      <Card>{firstCheck ? <FirstCheckEmpty state={firstCheck} /> : <p className="text-body-lg">{c.empty}</p>}</Card>
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
  // QA N1: a done fix leaves the Open list, so focus moves to the next fix's check-off (else the one
  // before, else the toast's Undo). Undo puts it back on the restored fix. Never on the page body.
  const focusAfterRender = (id: string | null) =>
    requestAnimationFrame(() => {
      const list = root.current;
      if (!list) return;
      const el = id && list.querySelector<HTMLElement>(`[data-fix-check="${CSS.escape(id)}"]`);
      (
        el ||
        list.querySelector<HTMLElement>("[data-toast-undo]") ||
        list.querySelector<HTMLElement>("[data-fix-check]")
      )?.focus();
    });
  const markDone = async (id: string, title: string, prev: FixStatus) => {
    const boxes = [...(root.current?.querySelectorAll<HTMLElement>("[data-fix-check]") ?? [])].map(
      (b) => b.dataset.fixCheck!,
    );
    const i = boxes.indexOf(id);
    const next = boxes[i + 1] ?? boxes[i - 1] ?? null;
    const ok = await set(id, "done", prev);
    if (ok) {
      setHeld({ focus: false, hover: false });
      setToast({ id, title, prev });
    }
    // In "All" the done row stays, so focus stays on it.
    focusAfterRender(filter === "all" || !ok ? id : next);
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
        expanded={isOpen(f.id)}
        onToggle={() => toggle(f.id)}
      />
    );
  };
  // G5: pillar groups when the fixes carry a pillar (always, on real data). Tidy-ups sit last inside P2.
  const pillared = [...ranked, ...tidyUps].some((f) => f.pillar);
  const tidyIds = new Set(tidyUps.map((f) => f.id));
  const pillarOf = (f: { id: string; pillar?: Pillar }) => (tidyIds.has(f.id) ? "p2" : f.pillar);
  const groupOpen = (p: Pillar) => rankedOpen.filter((f) => pillarOf(f) === p);
  const groupTotal = (p: Pillar) =>
    [...ranked, ...tidyUps].filter((f) => pillarOf(f) === p).length + done.filter((f) => f.pillar === p).length;
  const groupDoneRows = (p: Pillar) => doneRows.filter((r) => pillarOf(r) === p);
  const renderDone = (r: Row, lvl: 2 | 3 | 4) => (
    <FixRow
      key={r.id}
      row={r}
      state="done"
      canWrite={write}
      level={lvl}
      onDone={() => {}}
      onStart={() => {}}
      onReopen={() => set(r.id, "todo", "done")}
      expanded={isOpen(r.id)}
      onToggle={() => toggle(r.id)}
    />
  );
  // Done rows outside the groups: all of them without pillars, else only those with no pillar.
  const looseDone = pillared ? doneRows.filter((r) => !pillarOf(r)) : doneRows;
  // Rules the latest run couldn't check, above the groups.
  const uncheckedBlock = unchecked.length > 0 && (
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
  );
  const showOpen = filter !== "done";
  const showDone = filter !== "open";
  const labels: Record<Filter, string> = { open: c.open, done: c.doneTab, all: c.all };
  const counts: Record<Filter, number | null> = { open: openCount, done: doneRows.length, all: null };

  return (
    <div ref={root} className="flex flex-col gap-6">
      {failed && <Banner tone="error">{c.saveFailed}</Banner>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            data-computed
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

      {pillared ? (
        <>
          {showOpen && uncheckedBlock}
          {PILLAR_ORDER.map((p) => {
            // S2: done rows sit in their group, so a fully done group hides only in Open.
            const rows = showOpen ? groupOpen(p) : [];
            const tidyHere = showOpen && p === "p2" ? tidyOpen : [];
            const doneHere = showDone ? groupDoneRows(p) : [];
            if (!rows.length && !tidyHere.length && !doneHere.length) return null;
            const GroupHeading = (["h2", "h3"] as const)[level - 2];
            const TidyIn = (["h3", "h4"] as const)[level - 2];
            const cardLevel = (level + 1) as 3 | 4;
            return (
              <section key={p} data-pillar={p} aria-labelledby={`pillar-${p}`} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <GroupHeading
                    id={`pillar-${p}`}
                    aria-label={`${p.toUpperCase()}: ${c.pillars[p]}`}
                    className="flex items-center gap-2 text-ui font-medium"
                  >
                    <span className="inline-flex h-5 items-center rounded-tag border border-border px-1.5 font-mono text-tag text-text2">
                      {p.toUpperCase()}
                    </span>
                    <span>{c.pillars[p]}</span>
                  </GroupHeading>
                  <span
                    data-testid="group-count"
                    data-computed
                    className="font-mono text-caption text-inkMuted tabular-nums"
                  >
                    {`${groupDoneRows(p).length}/${groupTotal(p)}`}
                  </span>
                </div>
                {rows.length + doneHere.length > 0 && (
                  <ul aria-label={c.pillars[p]} className="flex flex-col">
                    {rows.map((f) => renderOpen(f, cardLevel))}
                    {doneHere.map((r) => renderDone(r, cardLevel))}
                  </ul>
                )}
                {tidyHere.length > 0 && (
                  <section aria-label={c.tidyUps} className="flex flex-col gap-3">
                    <TidyIn className="text-caption font-semibold text-text2">{c.tidyUps}</TidyIn>
                    <ul className="flex flex-col">{tidyHere.map((f) => renderOpen(f, 4))}</ul>
                  </section>
                )}
              </section>
            );
          })}
        </>
      ) : (
        <>
          {showOpen && rankedOpen.length > 0 && (
            <ul aria-label={c.title} className="flex flex-col">
              {rankedOpen.map((f) => renderOpen(f, level))}
            </ul>
          )}
          {showOpen && uncheckedBlock}
          {showOpen && tidyOpen.length > 0 && (
            <section aria-label={c.tidyUps} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <TidyHeading className="font-display text-section font-medium">{c.tidyUps}</TidyHeading>
                <span
                  data-testid="group-count"
                  data-computed
                  className="font-mono text-caption text-inkMuted tabular-nums"
                >
                  {tidyOpen.length}
                </span>
              </div>
              <ul className="flex flex-col">{tidyOpen.map((f) => renderOpen(f, level === 2 ? 3 : 4))}</ul>
            </section>
          )}
        </>
      )}
      {showDone && looseDone.length > 0 && (
        <section aria-label={c.doneTab} className="flex flex-col gap-3">
          <ul className="flex flex-col">{looseDone.map((r) => renderDone(r, level))}</ul>
        </section>
      )}

      {/* G5 P0: one baseline line at the bottom, not fixes. */}
      {baseline && baseline.denominator > 0 && (
        <p
          data-baseline
          className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-caption text-text2"
        >
          <span className="inline-flex h-5 items-center rounded-tag border border-border px-1.5 font-mono text-tag">
            P0
          </span>
          {baselineHref ? (
            <a
              href={baselineHref}
              className="text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
            >
              <span data-computed>{c.baseline(baseline)}</span>
            </a>
          ) : (
            <span data-computed>{c.baseline(baseline)}</span>
          )}
        </p>
      )}
      {toast && (
        <div
          role="status"
          onMouseEnter={() => setHeld((h) => ({ ...h, hover: true }))}
          onMouseLeave={() => setHeld((h) => ({ ...h, hover: false }))}
          onFocus={() => setHeld((h) => ({ ...h, focus: true }))}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setHeld((h) => ({ ...h, focus: false }));
          }}
          className="fixed right-4 bottom-4 z-30 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-4 gap-y-1 rounded-card border border-border bg-overlay px-4 py-3 text-ui shadow-overlay"
        >
          <span data-computed className="max-md:basis-full">
            {c.marked(toast.title)}
          </span>
          <TestLink id={toast.id} />
          <button
            type="button"
            onClick={async () => {
              const t = toast;
              setToast(null);
              setHeld({ focus: false, hover: false });
              await set(t.id, t.prev, "done");
              focusAfterRender(t.id);
            }}
            data-toast-undo
            className={`text-ui font-medium text-ink underline underline-offset-4 ${focus}`}
          >
            {c.undo}
          </button>
          <button
            type="button"
            aria-label={c.close}
            onClick={() => {
              setToast(null);
              setHeld({ focus: false, hover: false });
              focusAfterRender(null);
            }}
            className={`-m-2 grid size-11 shrink-0 place-items-center rounded-control text-inkMuted hover:text-ink md:size-8 ${focus}`}
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
