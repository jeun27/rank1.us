// G4 strings: COPY.md "UX (lead, 2026-11-06)", signed off by the lead (2026-11-06).
export const narrativeCopy = {
  title: "How AI describes you",
  settingsTitle: "How should AI describe you?",
  want: "Words that fit you",
  avoid: "Words to avoid",
  helper:
    'Short words or phrases, up to 8 each. We match the words and their endings, not synonyms, so "cheap" won\'t catch "affordable".',
  clash: (n: number, d: number, words: string[]) =>
    `${n} of ${d} answers use words you want to avoid: ${words.join(", ")}`,
  noClash: 'No clashes. None of your "avoid" words came up.',
  // The existing too-few line (COPY.md Experiments), on the Settings page only.
  tooFew: "Too few answers to call yet. Next check Monday.",
  inAnswers: (n: number, d: number) => `in ${n} of ${d} answers`,
  notYet: "not yet",
  neverHint: "Words that never come up are the next thing to say on your own pages.",
  noWords: "Tell us the words that fit you, and we'll check every AI answer for them.",
  addWords: "Add your words",
  remove: (word: string) => `Remove ${word}`,
  wordMatch: "Word match",
  edit: "Edit words",
  add: "Add",
  save: "Save",
  saved: "Saved.",
  failed: "We couldn't save that. Try again.",
  errMax: "Up to 8 words.",
  errLength: "2 to 40 characters.",
  errBoth: "That word is in the other list.",
};
