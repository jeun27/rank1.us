# 0046: save_business_card keeps a question whose template text changes only in case (data-pipeline, branch fix/card-case-dedupe)

Found by the db test in #215 (UI3 F2, lower-case category). Lead, 2026-11-07: O1, done by data-pipeline since backend is archived.

- Bug in 0044: a case-only template change ("best Plumber in Irvine" -> "best plumber in Irvine") switched the old unedited row off, then the insert skipped the new text because `lower(short_text)` matched that just-switched-off row. The question was lost, and active dropped by 1.
- 0046 redefines save_business_card (0044's text, one WHERE clause). The case-insensitive dedupe on insert now counts only active rows and owner rows (edited, hand-added, owner_off). An exact-text row still blocks, so a round trip gets its old id back.
- Unchanged: a row's text never changes, owner_off rows stay off, rows inherit by key, and the 25 cap order is the same.
- Rollback: supabase/rollbacks/20261105000046_card_case_dedupe.down.sql restores 0044's function verbatim.
- db tests (written first, red on the test-only commit 43238ab):
  - A case-only change keeps the active count; the old row is off and byte-identical, and the new row is active. The way back reuses the old id with no new row.
  - An owner row in another case still blocks the template text.
