## App page title and hero number back to spec (UX X6, branch fix/ui-title-hero-size)

- The app H1 rendered at 28px on phones and 36px from md (`text-h2` / `text-h2-md`), so the page name out-weighed the answer on 10 of 11 app screens (share/ux-psych X6). UI.md D33 says 22/28 at -0.02em at every width.
- New token `--text-title` 22/28. `Page` h1 uses `text-title tracking-[-0.02em]` with no md step; heading-gradient kept (dark only).
- `--text-hero` 48/52 → 44/48 (UI.md hero 36–44 / 1.1). Shared by /app, /client, /team and /audit through StatNumber. UI.md 4b audit row updated 48 → 44.
- `text-h2` / `text-h2-md` untouched: landing sizes.
- Tests: tokens (title + hero values), Page class, e2e computed size/line-height/letter-spacing on /dev/app at 375 + 1280 (failed on main with 28px / 36px).
