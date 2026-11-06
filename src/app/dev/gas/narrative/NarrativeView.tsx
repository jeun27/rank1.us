"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Query } from "../params";
import { Checked, Note, Panel, PillarTag, Proto, Status, TextAction } from "../ui";

const STATES = [
  { key: "clash", label: "Card: clash" },
  { key: "good", label: "Card: all good" },
  { key: "few", label: "Card: too few answers" },
  { key: "unset", label: "Card: no words yet" },
  { key: "settings", label: "Settings" },
  { key: "settings-empty", label: "Settings: empty" },
];

const WANT = ["handmade", "premium", "family-owned", "vegan options"];
const AVOID = ["cheap", "fast food", "chain"];
const MAX = 8;

// Stored answer text (Example data). The match is a plain word match, highlighted with <mark>.
const CLASHES = [
  {
    engine: "ChatGPT",
    question: "best ramen in Irvine",
    text: "…a cheap, no-frills spot near Diamond Jamboree…",
    word: "cheap",
  },
  {
    engine: "Perplexity",
    question: "late-night ramen near Diamond Jamboree",
    text: "…good cheap ramen that's open late…",
    word: "cheap",
  },
  {
    engine: "Gemini",
    question: "family friendly ramen Irvine",
    text: "…feels like fast food but the broth is solid…",
    word: "fast food",
  },
];

export function NarrativeView({ q }: { q: Query }) {
  const state = STATES.some((s) => s.key === q.state) ? q.state! : "clash";
  return (
    <Proto
      title="How AI describes you"
      intro="G4, the narrative gap. The client lists words that fit them and words to avoid. Each weekly check, we look for those exact words in the AI answers we already store. It's a word match, not an AI judgment, and nothing calls a model."
      states={STATES}
      state={state}
    >
      {state.startsWith("settings") ? <Settings empty={state === "settings-empty"} /> : <Card state={state} />}
    </Proto>
  );
}

function Card({ state }: { state: string }) {
  if (state === "unset")
    return (
      <Panel title="How AI describes you">
        <p className="text-ui">Tell us the words that fit you, and we&apos;ll check every AI answer for them.</p>
        <TextAction href="/dev/gas/narrative?state=settings-empty">Add your words</TextAction>
      </Panel>
    );
  if (state === "few")
    return (
      <Panel title="How AI describes you">
        <p className="text-ui">Too few answers to call yet. Next check Monday.</p>
        <Checked>Checked 2 d ago · 8 answers · API-measured, directional</Checked>
      </Panel>
    );
  if (state === "good")
    return (
      <Panel title="How AI describes you" aside={<Checked>Checked 14 h ago · 250 answers</Checked>}>
        <Status tone="success">No clashes. None of your &quot;avoid&quot; words came up.</Status>
        <ul className="flex flex-col gap-1.5 text-caption">
          <WordRow word="handmade" n={12} />
          <WordRow word="vegan options" n={7} />
          <WordRow word="premium" n={0} />
          <WordRow word="family-owned" n={0} />
        </ul>
        <p className="text-caption text-inkMuted">
          Words that never come up are the next thing to say on your own pages.
        </p>
      </Panel>
    );
  return (
    <Panel title="How AI describes you" aside={<Checked>Checked 14 h ago · 250 answers</Checked>}>
      <Status tone="error">
        3 of 250 answers use words you want to avoid: &quot;cheap&quot; and &quot;fast food&quot;.
      </Status>
      <ul className="flex flex-col gap-2">
        {CLASHES.map((c, i) => (
          <li key={i} className="flex flex-col gap-1 rounded-card border border-border p-2.5">
            <span className="flex flex-wrap items-center gap-x-2 text-caption text-inkMuted">
              <span className="font-medium text-text2">{c.engine}</span>·<span className="font-mono">{c.question}</span>
            </span>
            <p className="text-caption">
              <Highlight text={c.text} word={c.word} />
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-caption">
          Fix: say &quot;handmade&quot; and &quot;premium&quot; on your About page and Business Profile, so AI has your
          words to repeat.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <PillarTag pillar="P2" />
          <PillarTag pillar="P3" />
          <TextAction href="/dev/gas/fixes">See what to fix</TextAction>
        </div>
      </div>
    </Panel>
  );
}

function WordRow({ word, n }: { word: string; n: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span>&quot;{word}&quot;</span>
      <span className="text-inkMuted tabular-nums">
        {n ? (
          <>
            in <span className="font-mono">{n}</span> answers
          </>
        ) : (
          "not yet"
        )}
      </span>
    </li>
  );
}

function Highlight({ text, word }: { text: string; word: string }) {
  const at = text.indexOf(word);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-errorBg px-0.5 font-medium text-brick">{word}</mark>
      {text.slice(at + word.length)}
    </>
  );
}

function Settings({ empty }: { empty: boolean }) {
  const [saved, setSaved] = useState(false);
  return (
    <Panel title="How should AI describe you?">
      <p className="text-caption text-text2">
        Short words or phrases, up to <span className="font-mono">{MAX}</span> each. We match them exactly in AI
        answers, so &quot;cheap&quot; won&apos;t catch &quot;affordable&quot;.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Words
          label="Words that fit you"
          hint="Example: handmade, premium"
          initial={empty ? [] : WANT}
          onChange={() => setSaved(false)}
        />
        <Words
          label="Words to avoid"
          hint="Example: cheap, chain"
          initial={empty ? [] : AVOID}
          onChange={() => setSaved(false)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => setSaved(true)}>Save</Button>
        {saved && (
          <span role="status" className="text-caption text-moss">
            Saved.
          </span>
        )}
      </div>
      <Note>Lives in Settings → Business, under the business details. Changes apply from the next weekly check.</Note>
    </Panel>
  );
}

function Words({
  label,
  hint,
  initial,
  onChange,
}: {
  label: string;
  hint: string;
  initial: string[];
  onChange: () => void;
}) {
  const id = useId();
  const [words, setWords] = useState(initial);
  const [draft, setDraft] = useState("");
  const full = words.length >= MAX;
  const add = () => {
    const w = draft.trim().toLowerCase();
    if (!w || words.includes(w) || full) return;
    setWords([...words, w]);
    setDraft("");
    onChange();
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-caption font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          disabled={full}
          placeholder={hint}
          aria-describedby={`${id}-n`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-11 min-w-0 flex-1 rounded-control border border-fieldBorder bg-paper px-3 text-caption placeholder:text-inkMuted md:h-9 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
        />
        <Button variant="alt" onClick={add} disabled={full}>
          Add
        </Button>
      </div>
      <p id={`${id}-n`} className="text-caption text-inkMuted tabular-nums">
        <span className="font-mono">{words.length}</span> of <span className="font-mono">{MAX}</span>
      </p>
      {words.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {words.map((w) => (
            <li key={w}>
              <span className="inline-flex h-11 items-center gap-1 rounded-control border border-fieldBorder bg-raised pr-1 pl-2.5 text-caption md:h-7">
                {w}
                <button
                  type="button"
                  aria-label={`Remove ${w}`}
                  onClick={() => {
                    setWords(words.filter((x) => x !== w));
                    onChange();
                  }}
                  className="grid size-11 place-items-center rounded-control text-inkMuted hover:bg-overlay hover:text-ink md:size-6 focus-visible:outline-2 focus-visible:outline-jellyDeep"
                >
                  <Icon name="x" className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
