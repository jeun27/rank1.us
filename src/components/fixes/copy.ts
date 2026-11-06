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
  // Portal (b), the check-off Fix list: "Fix list (lead, 2026-11-06)". Shortcuts live in the tooltips and
  // aria-keyshortcuts (no legend line).
  start: "Start",
  startTip: "Start (s)",
  markDoneTip: "Mark done (x)",
  inProgress: "In progress",
  undo: "Undo",
  open: "Open",
  doneTab: "Done",
  all: "All",
  rankTeam: "Rank1 team",
  marked: (title: string) => `Marked “${title}” done`,
  doneOn: (date: string) => `Done ${date}`,
  progress: (done: number, total: number) => `${done} of ${total} done`,
};
