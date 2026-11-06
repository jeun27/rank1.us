// Fix list strings, all from docs/COPY.md (4b Fix list, "Fix list (lead, 2026-11-05)").
export const fixCopy = {
  title: "What to fix next",
  empty: "Nothing to fix yet. Run your first check.",
  unchecked: "We couldn’t check this yet.",
  noDomain: "Listing and site checks need your website URL",
  tidyUps: "Tidy-ups",
  status: "Status",
  statuses: { todo: "To do", doing: "Doing", done: "Done" },
  saveFailed: "We couldn't save that. Try again.",
  // Step 17: on since the experiments page exists.
  startTest: "Start a before/after test",
  affected: (n: number) => `${n} affected answers`,
};
