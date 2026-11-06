// G1 strings: COPY.md "GAS (lead, 2026-11-06)", G1 rows, signed off by the lead (2026-11-06).
export const youtubeCopy = {
  keyword: (k: string) => `Keyword: ${k}`,
  // Under R19 only (#150 review): captions can't be read with read-only access.
  saysLine: "Says the keyword: Can't check",
  noKeyword: "Add your main keyword to check your videos.",
  suggest: "Suggest fix",
  copy: "Copy",
  copied: "Copied",
  apply: "Apply in YouTube",
  comingSoon: "Coming soon",
  newTab: "(opens in a new tab)",
  // Copy-only templates (lead D3): nothing is written to YouTube. The stored evidence has no description,
  // so the R20 template is the opening to put before the first line.
  titleTemplate: (keyword: string, title: string) => `${keyword} | ${title}`,
  lineTemplate: (keyword: string, business: string) => `${keyword} at ${business}:`,
  chaptersTemplate: "0:00 Intro",
};
