"use client";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { WorkspaceView } from "@/lib/queries/workspace";
import type { Selection } from "@/lib/workspace/context";
import { DocView } from "./Docs";
import { rovingIndex } from "./hooks";

// clients: the team's Clients tab for the selected DFY client (Step 12); not a brief selection.
export type DocSel =
  Selection | { kind: "new"; n: number } | { kind: "clients" } | { kind: "connections" } | { kind: "narrative" };
export type Tab = { id: string; title: string; sel: DocSel };

const tool =
  "grid size-11 shrink-0 place-items-center rounded-card text-inkMuted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";

function Tool(props: { icon: IconName; label: string; pressed?: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.pressed}
      onClick={props.onClick}
      className={`${tool} ${props.pressed ? "bg-raised text-ink" : ""} ${props.className ?? ""}`}
    >
      <Icon name={props.icon} className="size-4" />
    </button>
  );
}

export function DocPane(props: {
  // The page's one H1: the section label (v3 PR 2b, lead Q1).
  title: string;
  view: WorkspaceView;
  tabs: Tab[];
  active: string;
  now: Date | null;
  split: boolean;
  expanded: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => Tab[];
  onNew: () => void;
  onPick: (sel: Selection, replace?: string) => void;
  onSplit: () => void;
  onExpand: () => void;
}) {
  const { tabs, active } = props;
  const [lastOther, setLastOther] = useState<string | null>(null);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];
  const other = tabs.find((t) => t.id === lastOther && t.id !== activeTab.id) ?? tabs.find((t) => t !== activeTab);
  const shown = props.split && other ? [activeTab, other] : [activeTab];

  useEffect(() => {
    document.getElementById(`tab-${activeTab.id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab.id]);

  const activate = (id: string) => {
    if (id !== activeTab.id) setLastOther(activeTab.id);
    props.onActivate(id);
  };
  const focusTab = (id: string) => requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus());

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2">
        <h1 className="heading-gradient shrink-0 px-2 text-ui font-medium">{props.title}</h1>
        <div role="tablist" aria-label="Document" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((t, i) => {
            const on = t.id === activeTab.id;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                aria-keyshortcuts="Delete"
                tabIndex={on ? 0 : -1}
                onClick={() => activate(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Delete") {
                    e.preventDefault();
                    const rest = props.onClose(t.id);
                    focusTab(rest[Math.min(i, rest.length - 1)].id);
                    return;
                  }
                  const j = rovingIndex(e, i, tabs.length);
                  if (j === null) return;
                  activate(tabs[j].id);
                  focusTab(tabs[j].id);
                }}
                className={`group flex h-11 min-w-11 max-w-48 shrink-0 items-center gap-2 rounded-control border pl-3 pr-1 text-caption font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep ${
                  on ? "border-border bg-raised text-ink" : "border-transparent text-inkMuted hover:text-ink"
                }`}
              >
                <Icon name="file" className="size-4 text-inkMuted" />
                <span data-computed className="truncate">
                  {t.title}
                </span>
                {/* Mouse shortcut; keyboard users press Delete or use the Close tab button. */}
                <span
                  aria-hidden
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onClose(t.id);
                  }}
                  className="grid size-6 shrink-0 place-items-center rounded-[6px] hover:bg-paper"
                >
                  <Icon name="x" className="size-3.5" />
                </span>
              </button>
            );
          })}
        </div>
        <Tool icon="plus" label="New tab" onClick={props.onNew} />
        <Tool icon="x" label="Close tab" onClick={() => props.onClose(activeTab.id)} />
        <Tool icon="expand" label="Expand" pressed={props.expanded} onClick={props.onExpand} />
        <Tool icon="split" label="Split" pressed={props.split} onClick={props.onSplit} className="max-md:hidden" />
      </div>
      <div className={`grid min-h-0 flex-1 ${shown.length === 2 ? "grid-cols-2 divide-x divide-border" : ""}`}>
        {shown.map((t) => (
          <div
            key={t.id}
            id={`panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${t.id}`}
            tabIndex={0}
            data-motion
            className="min-h-0 animate-fade-in overflow-y-auto px-6 py-6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep motion-reduce:animate-none"
          >
            <DocView
              view={props.view}
              sel={t.sel}
              now={props.now}
              onPick={(sel) => props.onPick(sel, t.sel.kind === "new" ? t.id : undefined)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
