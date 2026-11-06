"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { NarrativeResult } from "@/lib/metrics/narrative";
import type { NarrativeWords } from "@/lib/queries/narrative";
import { narrativeCopy as c } from "./copy";

type Kind = "want" | "avoid";
export type SaveWords = (w: NarrativeWords) => Promise<{ ok: true } | { error: string }>;

// The RPC's rules (0028): up to 8 per list, 2-40 characters, lowercase and trimmed, none in both lists.
export const MAX_WORDS = 8;
const clean = (w: string) => w.trim().toLowerCase().replace(/\s+/g, " ");

const field =
  "h-11 min-w-0 flex-1 rounded-control bg-paper px-3 text-ui text-ink ring-1 ring-inset ring-fieldBorder outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep md:h-9";
const action =
  "inline-flex min-h-11 items-center text-caption text-link underline underline-offset-4 md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

// G4 Settings → "How should AI describe you?" (lead OK 2026-11-06). Every count carries its base.
export function WordsEditor({
  words,
  result,
  save,
}: {
  words: NarrativeWords;
  // The latest run's match, for the per-word counts; null before words and a finished run.
  result: NarrativeResult | null;
  save: SaveWords;
}) {
  const [lists, setLists] = useState(words);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const count = (kind: Kind, word: string) => result?.[kind].find((w) => w.word === word)?.answers ?? null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-ui text-text2">{c.helper}</p>
      {(["want", "avoid"] as const).map((kind) => (
        <WordList
          key={kind}
          kind={kind}
          words={lists[kind]}
          other={lists[kind === "want" ? "avoid" : "want"]}
          count={(w) => count(kind, w)}
          n={result?.n ?? null}
          onChange={(next) => {
            setLists((l) => ({ ...l, [kind]: next }));
            setStatus("idle");
          }}
        />
      ))}
      {result && <p className="text-caption text-inkMuted">{c.neverHint}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          loading={status === "saving"}
          onClick={async () => {
            setStatus("saving");
            const r = await save(lists).catch(() => ({ error: "failed" }));
            setStatus("error" in r ? "failed" : "saved");
          }}
        >
          {c.save}
        </Button>
        <p role="status" className={`text-caption ${status === "failed" ? "text-brick" : "text-inkMuted"}`}>
          {status === "saved" ? c.saved : status === "failed" ? c.failed : ""}
        </p>
      </div>
    </div>
  );
}

function WordList({
  kind,
  words,
  other,
  count,
  n,
  onChange,
}: {
  kind: Kind;
  words: string[];
  other: string[];
  count: (word: string) => number | null;
  n: number | null;
  onChange: (next: string[]) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const w = clean(draft);
    if (!w) return;
    if (words.includes(w)) return setDraft("");
    if (words.length >= MAX_WORDS) return setError(c.errMax);
    if (w.length < 2 || w.length > 40) return setError(c.errLength);
    if (other.includes(w)) return setError(c.errBoth);
    setError(null);
    setDraft("");
    onChange([...words, w]);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-ui font-semibold">{kind === "want" ? c.want : c.avoid}</legend>
      {words.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {words.map((w) => {
            const k = count(w);
            return (
              <li key={w} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="text-ui font-medium">{w}</span>
                <span className="flex items-center gap-3">
                  {n !== null && (
                    <span data-computed className="text-caption text-inkMuted tabular-nums">
                      {k ? c.inAnswers(k, n) : c.notYet}
                    </span>
                  )}
                  <button type="button" onClick={() => onChange(words.filter((x) => x !== w))} className={action}>
                    {c.remove(w)}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          aria-label={kind === "want" ? c.want : c.avoid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className={field}
        />
        <Button variant="alt" onClick={add}>
          {c.add}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-caption text-brick">
          {error}
        </p>
      )}
    </fieldset>
  );
}
