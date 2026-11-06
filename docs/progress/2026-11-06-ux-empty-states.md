## Empty states with one next action (UX X25, plan PR 5, branch feat/ui-empty-states)

- Before the first check, every screen said "No weekly checks yet. Your first one runs Monday." even while a first check was already running, with no next step. Three components hand-rolled their own empty cards.
- `ui/EmptyState` takes a DomainField, one action (secondary link, or `primary`), or nothing. Jelly is 56px (UI.md "Empty" range).
- The sentence follows run state (lead edit c). `loadShell` adds `firstCheck`: "running" when a queued/running run exists and no result yet, else "monday". `FirstCheckEmpty`: running → "Your first check is running." (no action); monday → "Your first check runs Monday." + "Review your questions" (→ /app/questions).
- Used on: Dashboard (paid, no run), Fix list (no run yet; after a run, "Nothing to fix yet…" stays), History ("No weekly checks yet…" + review: History lists every status, so empty means none queued), /client ("The team's first check runs Monday." or running, no action), Questions ("No questions yet." + "Use the restaurant template"), the Dashboard no-business card ("Add my business", primary), /client access removed, and /team Docs `Empty`.
- COPY.md "UX (lead, 2026-11-06)" X25 row. UI.md Empty row updated.
