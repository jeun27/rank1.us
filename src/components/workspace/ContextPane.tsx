"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Freshness } from "@/components/ui/Freshness";
import { Icon } from "@/components/ui/Icon";
import type { WorkspaceView } from "@/lib/queries/workspace";
import {
  SECTION_LABEL,
  buildBrief,
  claudeUrl,
  contextFor,
  formatDate,
  linksText,
  namedText,
  type Section,
  type Selection,
} from "@/lib/workspace/context";

type Item = { sel: Selection; title: string; detail: string; you?: boolean };

function itemsFor(view: WorkspaceView, section: Section): Item[] {
  switch (section) {
    case "questions":
      return view.questions.map((q) => ({
        sel: { kind: "question", id: q.id },
        title: q.text,
        detail: namedText(q.visibility),
      }));
    case "competitors":
      return view.competitors.map((c) => ({
        sel: { kind: "competitor", name: c.name },
        title: c.name,
        detail: namedText(c.named),
        you: c.you,
      }));
    case "sources":
      return view.sources.domains.map((d) => ({
        sel: { kind: "domain", domain: d.domain },
        title: d.domain,
        detail: linksText(d.links),
      }));
    case "history":
      return view.checks.map((c) => ({
        sel: { kind: "check", runId: c.runId },
        title: formatDate(c.finishedAt),
        detail: namedText(c.visibility),
      }));
    default:
      return [];
  }
}

const same = (a: Selection, b: Selection) => JSON.stringify(a) === JSON.stringify(b);

export function ContextPane({
  view,
  section,
  selection,
  now,
  onSelect,
}: {
  view: WorkspaceView;
  section: Section;
  selection: Selection;
  now: Date | null;
  onSelect: (s: Selection) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const ctx = contextFor(view, selection);
  const brief = now ? buildBrief(ctx, now, prompt) : "";
  const items = itemsFor(view, section);
  const copy = (message: string) => navigator.clipboard.writeText(brief).then(() => setStatus(message));

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 px-4">
        <h1 className="truncate text-caption font-semibold">{SECTION_LABEL[section]}</h1>
        <Badge tone="info">Example data</Badge>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <section className="rounded-card border border-border bg-paper p-4">
          {selection.kind !== "section" && (
            <h2 data-computed className="mb-2 text-ui font-semibold">
              {ctx.title}
            </h2>
          )}
          {now && ctx.checkedAt && (
            <div data-computed>
              <Freshness checkedAt={ctx.checkedAt} answers={ctx.answers} now={now} />
            </div>
          )}
          {ctx.empty && <p className="mt-2 text-ui">{ctx.empty}</p>}
          {ctx.facts.length > 0 && (
            <dl className="mt-3 flex flex-col gap-2 text-caption">
              {ctx.facts.map((f) => (
                <div key={f.label} className="flex flex-wrap justify-between gap-x-4">
                  <dt data-computed className="text-inkMuted">
                    {f.label}
                  </dt>
                  <dd data-computed className="tabular-nums">
                    {f.text}
                  </dd>
                  {f.note && (
                    <dd data-computed className="w-full text-inkMuted">
                      {f.note}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          )}
        </section>

        {items.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.title}>
                <button
                  type="button"
                  aria-current={same(it.sel, selection) ? "true" : undefined}
                  onClick={() => onSelect(it.sel)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-card border border-border px-3 py-2 text-left hover:bg-raised focus-visible:outline-2 focus-visible:outline-jellyDeep ${
                    same(it.sel, selection) ? "bg-raised" : ""
                  }`}
                >
                  <Icon name="file" className="size-4 text-amber" />
                  <span className="min-w-0 flex-1">
                    <span data-computed className="block truncate text-caption font-semibold">
                      {it.title}
                    </span>
                    <span data-computed className="block text-caption text-inkMuted tabular-nums">
                      {it.detail}
                    </span>
                  </span>
                  {it.you && <Badge tone="info">You</Badge>}
                  <Icon name="chevronRight" className="size-4 text-inkMuted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* A prompt template only: it feeds the brief. Nothing here calls a model. */}
      <div className="m-3 mt-0 shrink-0 rounded-surface border border-border bg-raised p-3">
        <label htmlFor="ws-prompt" className="px-1 text-caption text-inkMuted">
          Prompt template
        </label>
        <textarea
          id="ws-prompt"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-1 block w-full resize-none rounded-card bg-transparent px-1 text-ui focus-visible:outline-2 focus-visible:outline-jellyDeep"
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button onClick={() => copy("Copied")} disabled={!now}>
            Copy context
          </Button>
          <a
            href={now ? claudeUrl(brief) : "https://claude.ai/new"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => copy("Brief copied. Paste it in Claude if the box is empty.")}
            className="inline-flex min-h-11 items-center gap-2 px-1.5 text-ui font-semibold text-jellyDeep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
          >
            Open in Claude
            <Icon name="arrowRight" className="size-4" />
          </a>
          <p role="status" className="text-caption text-inkMuted">
            {status}
          </p>
        </div>
      </div>
    </>
  );
}
