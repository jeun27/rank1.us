## /client theme toggle (frontend, branch fix/client-theme-toggle)

- QA/reviewer gap (UI.md:8, D40): /client had the theme but no toggle. AppHeader (the /client header, also the /team placeholders) now carries the same ThemeToggle ("Dark theme", aria-pressed) on the same prefs. The before-paint script already themes /client (THEMED covers it), so a saved choice wins from the first paint. /dev/client renders the same header.
- QA N1, two flaky e2e tests made deterministic without weakening them: experiments.spec waits for the first cell; the landing demo test holds the IntersectionObserver until it fires it and drives the run with the page clock, so the start and mid-run frames are exact.
