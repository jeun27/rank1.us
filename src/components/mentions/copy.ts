// G7 strings: COPY.md "UX (lead, 2026-11-06)", signed off by the lead (2026-11-06).
export const mentionsCopy = {
  title: "Lists that name your rivals but not you",
  sub: "Pages AI cites that name competitors but not you",
  // Up to 3 rivals, then "+{n}".
  names: (rivals: string[]) =>
    `Names ${rivals.slice(0, 3).join(", ")}${rivals.length > 3 ? ` +${rivals.length - 3}` : ""}`,
  // A list with no known rivals: R17's one-list no-rivals copy (COPY.md GAS, lead #131).
  noRivals: "1 list AI cites doesn't name you.",
  rivalsLine: (rivals: string[]) => (rivals.length ? mentionsCopy.names(rivals) : mentionsCopy.noRivals),
  answers: (k: number, n: number, engines: string[]) =>
    `In ${k} of ${n} answers${engines.length ? ` · ${engines.join(", ")}` : ""}`,
  add: "Add to fixes",
  notRelevant: "Not relevant",
  added: "Added",
  view: "View",
  remove: "Remove",
  restore: "Restore",
  dismissedCount: (n: number) => `Not relevant (${n})`,
  emptyFirst: "No lists like this yet. They show after your first run.",
  emptyNone: "None in your last run. We check again on every run.",
  failed: "We couldn't save that. Try again.",
  more: (n: number) => `+${n} more`,
  // Visually hidden on every new-tab link (#142 review).
  newTab: "(opens in a new tab)",
};
