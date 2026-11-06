// G4 on Example data: invented words and an invented answer snippet.
import type { NarrativeView } from "@/lib/narrative/service";

export const exampleNarrative: NarrativeView = {
  words: { want: ["fresh", "family friendly", "handmade noodles"], avoid: ["cheap", "greasy"] },
  checkedAt: "2026-11-05T12:30:00Z",
  result: {
    n: 48,
    tooFew: false,
    want: [
      { word: "fresh", answers: 20 },
      { word: "family friendly", answers: 7 },
      { word: "handmade noodles", answers: 0 },
    ],
    avoid: [
      { word: "cheap", answers: 6 },
      { word: "greasy", answers: 0 },
    ],
    clashes: 6,
    snippet: {
      text: "…Example Ramen House is a cheap spot near Diamond Jamboree, with fast service and…",
      start: 26,
      end: 31,
      word: "cheap",
      kind: "avoid",
    },
  },
};
export const exampleNarrativeNoClash: NarrativeView = {
  ...exampleNarrative,
  result: {
    ...exampleNarrative.result!,
    avoid: [
      { word: "cheap", answers: 0 },
      { word: "greasy", answers: 0 },
    ],
    clashes: 0,
    snippet: null,
  },
};
export const exampleNarrativeNoWords: NarrativeView = { words: { want: [], avoid: [] }, checkedAt: null, result: null };
