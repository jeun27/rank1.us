## Phone bottom nav (UX X2, plan PR 16, branch feat/app-phone-bottom-nav)

- On phones the rail was a sideways-scrolling row at the top: item 5 sat off-screen, and every tap reached across the screen.
- Below md, /app has a fixed bottom bar in the rail colour: Dashboard · What to fix next · Competitors · More, 4 × 56px targets with the safe-area inset and 12/16 labels. The current page is marked (aria-current and the accent icon). A page under More lights More.
- "More" (COPY.md, approved) is a `<details>` sheet above the bar with the other pages (+ Settings when on) and Account. Escape closes it and returns focus, and it closes on navigation.
- The sideways row is gone: the rail wrapper is `display: contents` on phones, and the content pads for the bar. During onboarding (no bar) Account stays in a rail-coloured row so sign-out works.
- UI.md nav rail phone line updated. A new `more` icon.
- /team and /client get the same bar in PR 17.
