# DQ4: the % and its n as two parts of one table cell (design-quality, branch polish/visibility-cell)

Audit: share/design-quality/AUDIT.md DQ4. Every visibility cell was one string, "33% (named in 80 of 240 answers)". At 375 it wrapped mid-phrase ("…of 240 / answers)"), pushed the business name onto three lines, and made 82px rows.

- `VisibilityCell` (src/components/ui/StatNumber.tsx): the % in mono 500 (UI.md: table numbers in mono) and "named in n of d answers" as a muted caption on its own line (it may wrap between its own words in a narrow column, never into the %; a nowrap caption overflowed the /client History table at 375). Below md it stacks under the %. From md it sits on the same baseline, so desktop rows stay 44px. The words are unchanged (no new copy) and it reads as one phrase.
- Used by the leaderboard (AuditView → Dashboard, Competitors, audit results), the /team Competitors and History docs, the client queue, and /app History.
- Text outputs (context markdown, report data, the brief) keep `visibilityText`, unchanged.
- Rows at 375: 82 → 60px. At 1280: 44px, unchanged.
- Tests: table.test.tsx (VisibilityCell), shell.test.tsx (Competitors: % mono, n no-wrap). The Dashboard and audit-results hero checks now count text outside and inside the leaderboard separately, since the You row repeats the hero's % and n.
