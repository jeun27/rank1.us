## Tables stack on phones and pin the You row (UX X8 / S5, branch feat/ui-table-stack)

- Below md the leaderboard scrolled sideways, so the result column sat off-screen, and Competitors hand-rolled a second phone-only card list to work around it.
- `ui/Table` takes `stack` and `pin(i)`. With `stack`, below md a row is two lines: the first column and the result (first numeric column, else the last) on line 1, the other columns under it with their header ("Change –", aria-hidden prefix; the thead stays for screen readers as sr-only). `pin(i)` tints that row infoBg at every width and moves it first on phones with CSS order (DOM order kept). Headers are `sticky top-0`.
- `Leaderboard` (/audit, /app Dashboard + Competitors, /client) passes `stack` and pins the business row. The CompetitorsView phone `<ul>` is deleted.
- Not done from S5: `font-mono` on every numeric cell. The leaderboard cell is "33% (named in 80 of 240 answers)" and UI.md keeps the "named in" sentence in Inter, so a blanket mono would break that rule. Left for F1.
- /team `Docs.tsx` has its own leaderboard (inventory DUP), so it doesn't get the stack yet. The GAS ports (G1, G2) can pass `stack`.
