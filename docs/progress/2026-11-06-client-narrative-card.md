## Q4 (frontend): the read-only narrative clash card on /client (branch feat/client-narrative-card)

- Lead OK 2026-11-06. It follows the /app Dashboard's rule: the card shows only for a clash. Nothing renders for no clash, too few answers, no words or no finished run. Behind ENABLE_NARRATIVE (loadDashboardNarrative returns null otherwise).
- NarrativeDashboard has a new readOnly prop. It's the same clash card (the count line and the word-match snippet) but with no links. There's no "Edit words" and no quiet no-words line, because the team sets a DFY client's words in /team (#173).
- ClientDashboard gets a narrative slot after the connect notice and before Visibility, the /app Dashboard's slot.
- loadClient reads the words with the client's own session. RLS lets a dfy_client read them but never set them.
- No new copy: G4's existing strings.
- /dev/client has two new states, narrative and narrative-no-clash. Shots: docs/qa/client-narrative-*.png.
