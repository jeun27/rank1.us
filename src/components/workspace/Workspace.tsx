"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { WorkspaceView } from "@/lib/queries/workspace";
import { contextFor, type Section, type Selection } from "@/lib/workspace/context";
import { SPLIT_MAX, SPLIT_MIN, writePrefs } from "@/lib/workspace/prefs";
import { ContextPane } from "./ContextPane";
import { DocPane, type DocSel, type Tab } from "./DocPane";
import { Sidebar } from "./Sidebar";
import { rovingIndex, useNow, usePrefs } from "./hooks";

const PANES = ["Nav", "Context", "Document"] as const;
type Pane = (typeof PANES)[number];
const PANE_ID: Record<Pane, string> = { Nav: "ws-nav", Context: "ws-context", Document: "ws-document" };

const docId = (s: DocSel) =>
  s.kind === "section"
    ? `section-${s.section}`
    : s.kind === "new"
      ? `new-${s.n}`
      : `${s.kind}-${(s.kind === "question" ? s.id : s.kind === "competitor" ? s.name : s.kind === "domain" ? s.domain : s.runId).replace(/\W+/g, "-")}`;

export function Workspace({ view }: { view: WorkspaceView }) {
  const prefs = usePrefs();
  const now = useNow();
  const tabOf = (sel: DocSel): Tab => ({
    id: docId(sel),
    sel,
    title: sel.kind === "new" ? "New tab" : contextFor(view, sel).title,
  });
  const first = tabOf({ kind: "section", section: "dashboard" });

  const [section, setSection] = useState<Section>("dashboard");
  const [selection, setSelection] = useState<Selection>({ kind: "section", section: "dashboard" });
  const [tabs, setTabs] = useState<Tab[]>([first]);
  const [active, setActive] = useState(first.id);
  const [recents, setRecents] = useState<Tab[]>([first]);
  const [mode, setMode] = useState<"workspace" | "analytics">("workspace");
  const [expanded, setExpanded] = useState(false);
  const [split, setSplit] = useState(false);
  const [pane, setPane] = useState<Pane>("Context");
  const newTabs = useRef(0);
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else if (split) setSplit(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, split]);

  const openDoc = (sel: DocSel, replace?: string) => {
    const t = tabOf(sel);
    setTabs((ts) => {
      const without = replace ? ts.filter((x) => x.id !== replace || x.id === t.id) : ts;
      if (without.some((x) => x.id === t.id)) return without;
      const at = replace ? ts.findIndex((x) => x.id === replace) : -1;
      return at >= 0 ? [...without.slice(0, at), t, ...without.slice(at)] : [...without, t];
    });
    setActive(t.id);
    if (sel.kind !== "new") setRecents((rs) => [t, ...rs.filter((r) => r.id !== t.id)].slice(0, 5));
  };

  const select = (sel: Selection, replace?: string) => {
    setSelection(sel);
    if (sel.kind === "section") setSection(sel.section);
    openDoc(sel, replace);
  };

  const closeTab = (id: string) => {
    const i = tabs.findIndex((t) => t.id === id);
    let rest = tabs.filter((t) => t.id !== id);
    if (!rest.length) rest = [tabOf({ kind: "new", n: ++newTabs.current })];
    setTabs(rest);
    if (id === active) setActive(rest[Math.min(i, rest.length - 1)].id);
    return rest;
  };

  const setSplitPct = (n: number) => writePrefs({ split: n });
  const onDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !row.current) return;
    const r = row.current.getBoundingClientRect();
    setSplitPct(((e.clientX - r.left) / r.width) * 100);
  };

  const showContext = !expanded && mode === "workspace";
  // Phones: the context pane (main, with the H1) stays put; Nav and Document open as full sheets over it.
  const sheet = (p: Pane) =>
    `max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:bottom-14 max-md:z-10 ${pane === p ? "" : "max-md:hidden"}`;
  const motion = "transition-[width,flex-basis] duration-200 motion-reduce:transition-none";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink md:flex-row">
      {/* Team nav is always dark (ENG_HANDOFF_OVERNIGHT §3); the dark tokens apply to this subtree. */}
      <nav
        id="ws-nav"
        data-theme="dark"
        data-motion
        className={`flex-col bg-paper text-ink md:shrink-0 md:border-r md:border-border ${motion} ${
          expanded ? "hidden" : `flex ${sheet("Nav")}`
        } ${prefs.collapsed ? "md:w-14" : "md:w-14 lg:w-60"}`}
      >
        <Sidebar
          view={view}
          section={section}
          onNav={(s) => {
            select({ kind: "section", section: s });
            setPane("Context");
          }}
          mode={mode}
          onMode={setMode}
          recents={recents}
          onRecent={(t) => {
            if (t.sel.kind !== "new") select(t.sel);
            setPane("Document");
          }}
          theme={prefs.theme}
          onTheme={() => writePrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })}
          collapsed={prefs.collapsed}
          onCollapse={() => writePrefs({ collapsed: !prefs.collapsed })}
        />
      </nav>
      <div ref={row} className="flex min-h-0 min-w-0 flex-1" style={{ ["--ws-split" as string]: `${prefs.split}%` }}>
        <main
          id="ws-context"
          data-motion
          className={`min-w-0 flex-col bg-white max-md:flex-1 md:shrink-0 md:grow-0 md:basis-(--ws-split) ${motion} ${
            showContext ? "flex" : "hidden"
          }`}
        >
          <ContextPane
            view={view}
            section={section}
            selection={selection}
            now={now}
            onSelect={(sel) => {
              select(sel);
              setPane("Document");
            }}
          />
        </main>
        <aside
          id="ws-document"
          data-motion
          className={`relative min-w-0 flex-1 flex-col bg-white md:border-l md:border-border ${motion} ${expanded ? "flex max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:bottom-14" : `flex ${sheet("Document")}`}`}
        >
          {showContext && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panes"
              aria-controls="ws-context"
              aria-valuenow={prefs.split}
              aria-valuemin={SPLIT_MIN}
              aria-valuemax={SPLIT_MAX}
              tabIndex={0}
              onKeyDown={(e) => {
                const step = { ArrowLeft: -5, ArrowRight: 5 }[e.key];
                if (step) setSplitPct(prefs.split + step);
                else if (e.key === "Home") setSplitPct(SPLIT_MIN);
                else if (e.key === "End") setSplitPct(SPLIT_MAX);
                else return;
                e.preventDefault();
              }}
              onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
              onPointerMove={onDrag}
              className="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none focus-visible:outline-2 focus-visible:outline-jellyDeep max-md:hidden"
            >
              <span className="absolute inset-y-0 left-1/2 w-px group-hover:bg-jellyDeep group-focus-visible:bg-jellyDeep" />
            </div>
          )}
          <DocPane
            view={view}
            tabs={tabs}
            active={active}
            now={now}
            split={split}
            expanded={expanded}
            onActivate={setActive}
            onClose={closeTab}
            onNew={() => openDoc({ kind: "new", n: ++newTabs.current })}
            onPick={select}
            onSplit={() => setSplit((x) => !x)}
            onExpand={() => setExpanded((x) => !x)}
          />
        </aside>
      </div>
      <footer className="border-t border-border bg-paper md:hidden">
        <div role="tablist" aria-label="Workspace" className="grid grid-cols-3">
          {PANES.map((p, i) => (
            <button
              key={p}
              id={`pane-tab-${p}`}
              role="tab"
              aria-selected={pane === p}
              aria-controls={PANE_ID[p]}
              tabIndex={pane === p ? 0 : -1}
              onClick={() => {
                setPane(p);
                setExpanded(false);
              }}
              onKeyDown={(e) => {
                const j = rovingIndex(e, i, PANES.length);
                if (j === null) return;
                setPane(PANES[j]);
                document.getElementById(`pane-tab-${PANES[j]}`)?.focus();
              }}
              className={`h-14 text-caption font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep ${
                pane === p ? "text-ink" : "text-inkMuted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
