// Audit strings, all from docs/COPY.md (4b Audit progress / results, Footer credit, "Audit (lead, 2026-11-05)").
export const auditCopy = {
  titlePaid: "Audit results",
  titleFree: "Your free audit",
  checking: "Checking 4 AI engines…",
  stillChecking: "still checking",
  engineDown: (engine: string) => `${engine} isn't answering right now. We'll retry; your other results are saved.`,
  noAnswers: (engine: string) => `No answers from ${engine} yet`,
  runFailed: "We couldn't finish this audit. Try again later.",
  tooFew: "too few answers",
  you: "You",
  competitors: "Competitors",
  sources: "Sources",
  engine: "Engine",
  named: "Named",
  business: "Business",
  visibility: "Visibility",
  change: "Change",
  downloadCsv: "Download CSV",
  downloadPng: "Download PNG",
  paywall: "Start for $99/mo",
  // COPY.md "UX (lead, 2026-11-06)" X4.
  // X4 (approved). n = the engines the audit table renders (ENGINES), so the sentence stays true if engines change.
  ctaLead: (n: number) => `Rank1 checks these ${n} AI engines every week and shows you what to fix next.`,
  credit: "Powered by Rank1",
};
