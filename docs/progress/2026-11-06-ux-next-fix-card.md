## Next-fix card on the Dashboard (UX X1 + X1b, plan PR 6, branch feat/app-next-fix-card)

- The Dashboard ended with 3 plain fix titles below the tables, so "what do I do next?" sat about 1.6 screens down on phones and had no link per fix.
- Slot 2 is now one card with the first open fix in the Fix list order (#125): status mark (FixList's `Mark`, read-only), title, evidence line (3 lines max), "{n} affected answers" when known, and one text link "What to fix next →" to `/app/fixes#fix-{id}` (PR 7 expands that row). At md+ the hero takes 7/12 and the card 5/12. No open fix: no card and no empty line (the Fix list's empty state covers it), and the hero is full width.
- Order: hero (+ card) → C-b `notice` → Visibility → Competitors → "By engine" (EngineTable in a closed `<details>` at every width, X1b; label from COPY.md "PDF section headings").
- `getTopFixes(…, 1)` on /app. `appCopy.noFixes` removed (no other user). Uses F1's `text-section` (#132).
