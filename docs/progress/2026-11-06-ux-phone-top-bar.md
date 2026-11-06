## One-row phone top bar (UX X9a, plan PR 13, branch feat/app-phone-top-bar)

- On phones the top 150px were chrome: the rail row, then "Rank1 / business / page" plus the theme toggle.
- Below md the breadcrumb shows the page name only. "Rank1" is md+. The business crumb hides when it's a plain name (`data-crumb-static`: one business on /app, the string crumb, /team without a team). It stays when it's a real switcher (several businesses on /app, /team's client switcher), so switching still works on phones. Separators follow the visible crumbs. Pushback on S6, which hid the /app crumb even when it's the switcher.
- The theme toggle is md+ in the bar. Below md it's in Account, above Sign out, as "Dark theme" with its icon (`ThemeToggle labelled`, the same prefs and aria-pressed). /app (AppShell), /client (AppHeader) and /team (Sidebar Account) all work this way.
- AppShell renders the toggle itself. Its `actions` prop is removed (both callers passed `<ThemeToggle />`).
- Tests changed for the new phone layout: v3-drift C5 counts visible crumbs; theme.spec skips the Rank1-crumb path below md; client-theme.spec uses the Account toggle on phones; three unit shell tests tell the bar toggle from the Account copy.
