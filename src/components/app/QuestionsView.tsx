"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ENGINES, ENGINE_LABEL } from "@/components/audit/contract";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { locationLabel } from "@/lib/metrics";
import type { QuestionsWithLatestAnswers, QuestionWithAnswers } from "@/lib/queries/shell";
import { appCopy as c } from "./copy";
import { Page } from "./Page";

// One dot per answer of the latest run: filled = named, ring = not named, '–' = failed (not counted).
function Dots({ q }: { q: QuestionWithAnswers }) {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1">
      {ENGINES.map((e) => {
        const answers = q.answers.filter((a) => a.engine === e).sort((a, b) => a.run_index - b.run_index);
        const ok = answers.filter((a) => a.status === "ok");
        return (
          <span key={e} className="flex items-center gap-1.5 text-caption">
            <span className="text-inkMuted">{ENGINE_LABEL[e]}</span>
            <span aria-hidden className="flex items-center gap-1">
              {answers.map((a) =>
                a.status === "failed" ? (
                  <span key={a.run_index} title={c.failedCheck} className="text-inkMuted">
                    –
                  </span>
                ) : (
                  <span
                    key={a.run_index}
                    className={`size-2.5 rounded-full border-2 border-jellyDeep ${a.mentioned ? "bg-jellyDeep" : ""}`}
                  />
                ),
              )}
            </span>
            <span data-computed className="sr-only">
              {`named in ${ok.filter((a) => a.mentioned).length} of ${ok.length} answers`}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Drawer({ q, onClose }: { q: QuestionWithAnswers; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const title = useId();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);
  // Modal: Esc closes, Tab stays inside.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab" || !ref.current) return;
    const f = [...ref.current.querySelectorAll<HTMLElement>("button, a[href]")];
    if (!f.length) return;
    const [first, last] = [f[0], f[f.length - 1]];
    const wrapTo = e.shiftKey
      ? document.activeElement === first
        ? last
        : null
      : document.activeElement === last
        ? first
        : null;
    if (wrapTo) {
      e.preventDefault();
      wrapTo.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/30" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        onKeyDown={onKey}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-paper p-5 md:max-w-xl md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={title} data-computed className="font-display text-h3 font-semibold">
            {q.text}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-fieldBorder bg-white px-4 text-ui font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
          >
            {c.close}
          </button>
        </div>
        <ul className="flex flex-col gap-3">
          {q.answers.map((a) => (
            <li
              key={`${a.engine}-${a.run_index}`}
              className="flex flex-col gap-2 rounded-card border border-border bg-white p-4"
            >
              <p className="text-caption font-semibold">
                <span data-computed>{`${ENGINE_LABEL[a.engine]} ${a.run_index}`}</span>
              </p>
              {a.status === "failed" ? (
                <p className="text-caption text-inkMuted">{c.failedCheck}</p>
              ) : (
                <p data-computed className="text-ui">
                  {a.text}
                </p>
              )}
              {a.citations.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-caption text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
                >
                  <Icon name="link" className="size-4" />
                  <span data-computed>{s.domain}</span>
                </a>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// UI.md 4b Questions: read-only in Step 8.
export function QuestionsView({ data }: { data: QuestionsWithLatestAnswers }) {
  const [open, setOpen] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const q = data.questions.find((x) => x.id === open);
  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };
  if (!data.questions.length)
    return (
      <Page title={c.questions}>
        <Card>
          <div className="flex flex-col items-start gap-4">
            <p className="text-body-lg">{c.noQuestions}</p>
            <Button href="/app/onboarding">{c.useTemplate}</Button>
          </div>
        </Card>
      </Page>
    );
  return (
    <Page title={c.questions}>
      <ul className="flex flex-col gap-2">
        {data.questions.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              onClick={(e) => {
                opener.current = e.currentTarget;
                setOpen(x.id);
              }}
              className="flex w-full flex-col gap-2 rounded-card border border-border bg-white px-4 py-3 text-left hover:bg-paper focus-visible:outline-2 focus-visible:outline-jellyDeep"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span data-computed className="text-ui font-semibold">
                  {x.text}
                </span>
                <Badge tone="info">{locationLabel(x.location_level)}</Badge>
              </span>
              <Dots q={x} />
            </button>
          </li>
        ))}
      </ul>
      {q && <Drawer q={q} onClose={close} />}
    </Page>
  );
}
