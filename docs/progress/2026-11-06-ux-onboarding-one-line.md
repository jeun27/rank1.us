# UX PR 26b: onboarding step 3 as one-line rows (X23)

- Stacked on #175 (26a). Each question is one line: Track (sr-only label "Track"), the short form as the row's toggle button (aria-expanded/aria-controls), "Edited" when changed, and the location tag (City/State/Country).
- One row open at a time (`open` in QuestionsStep); opening focuses Short form. Finish with an empty tracked question opens that row.
- The Bar takes `pinned` for step 3, so it sticks at every width, with "{n} of {total} questions tracked" (total = MAX_ACTIVE_QUESTIONS).
- Gotchas: a `<fieldset>` defaults to min-inline-size: min-content, so the row needs `min-w-0` or long questions push the page sideways at 375. An emptied short form shows the muted "Short form" label so the toggle keeps an accessible name (axe button-name).
