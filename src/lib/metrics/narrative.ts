// G4 "How AI describes you": a word match over stored answers that name the business (no LLM, nothing
// stored). Only text within ±200 characters of the business name or an alias counts. A word matches with
// the simple endings s/es/er/est (lead U4), case-insensitive, as a whole word; a phrase takes the ending
// on its last word. Counts are answers, not occurrences, always with n.
export const WINDOW = 200;
export const NARRATIVE_MIN_ANSWERS = 10;
const SNIPPET_SIDE = 80;

export type NarrativeAnswer = { key: string; status: string; mentioned: boolean | null; text: string | null };
export type NarrativeInput = {
  names: string[]; // the business name + aliases
  words: { want: string[]; avoid: string[] };
  answers: NarrativeAnswer[]; // the latest answer per question and engine
};
export type WordCount = { word: string; answers: number };
export type Snippet = { text: string; start: number; end: number; word: string; kind: "want" | "avoid" };
export type NarrativeResult = {
  n: number;
  tooFew: boolean;
  want: WordCount[];
  avoid: WordCount[];
  clashes: number; // answers using ≥1 avoid word
  snippet: Snippet | null;
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const L = "[\\p{L}\\p{N}]";
const wordRe = (w: string) => {
  const parts = w.trim().toLowerCase().split(/\s+/).map(esc);
  const last = parts.pop()!;
  return new RegExp(`(?<!${L})${[...parts, `${last}(?:s|es|er|est)?`].join("\\s+")}(?!${L})`, "giu");
};

// [start, end) ranges within WINDOW characters of any name occurrence, merged.
function windows(text: string, names: string[]): [number, number][] {
  const out: [number, number][] = [];
  for (const name of names.filter((x) => x.trim())) {
    const re = new RegExp(`(?<!${L})${esc(name.trim())}(?!${L})`, "giu");
    for (const m of text.matchAll(re))
      out.push([Math.max(0, m.index - WINDOW), Math.min(text.length, m.index + m[0].length + WINDOW)]);
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const w of out) {
    const last = merged.at(-1);
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else merged.push([...w]);
  }
  return merged;
}

type Hit = { start: number; end: number };
const hitsIn = (text: string, word: string, wins: [number, number][]): Hit[] =>
  [...text.matchAll(wordRe(word))]
    .map((m) => ({ start: m.index, end: m.index + m[0].length }))
    .filter((h) => wins.some(([a, b]) => h.start >= a && h.end <= b));

// ~160 characters around the hit, cut on word boundaries with "…". A cut never moves past the hit: when a
// long token runs up to (or from) it, the token itself is cut, so the offsets stay inside the snippet.
function snippet(text: string, hit: Hit, word: string, kind: Snippet["kind"]): Snippet {
  let a = Math.max(0, hit.start - SNIPPET_SIDE);
  let b = Math.min(text.length, hit.end + SNIPPET_SIDE);
  if (a > 0) {
    const space = text.indexOf(" ", a);
    if (space !== -1 && space < hit.start) a = space + 1;
  }
  if (b < text.length) {
    const space = text.lastIndexOf(" ", b);
    if (space > hit.end) b = space;
  }
  const raw = text.slice(a, b);
  const lead = raw.length - raw.trimStart().length;
  const pre = a > 0 ? "…" : "";
  const start = pre.length + (hit.start - a - lead);
  return {
    text: `${pre}${raw.trim()}${b < text.length ? "…" : ""}`,
    start,
    end: start + (hit.end - hit.start),
    word,
    kind,
  };
}

export function matchNarrative(input: NarrativeInput): NarrativeResult {
  const named = input.answers.filter((a) => a.status === "ok" && a.mentioned && a.text);
  const per = named.map((a) => ({ text: a.text!, wins: windows(a.text!, input.names) }));
  const count = (words: string[]) =>
    words.map((word) => ({ word, answers: per.filter((p) => hitsIn(p.text, word, p.wins).length > 0).length }));
  const want = count(input.words.want);
  const avoid = count(input.words.avoid);
  const clashes = per.filter((p) => input.words.avoid.some((w) => hitsIn(p.text, w, p.wins).length)).length;
  const first = (words: string[], kind: Snippet["kind"]) => {
    for (const p of per)
      for (const w of words) {
        const [h] = hitsIn(p.text, w, p.wins);
        if (h) return snippet(p.text, h, w, kind);
      }
    return null;
  };
  return {
    n: named.length,
    tooFew: named.length < NARRATIVE_MIN_ANSWERS,
    want,
    avoid,
    clashes,
    snippet: first(input.words.avoid, "avoid") ?? first(input.words.want, "want"),
  };
}
