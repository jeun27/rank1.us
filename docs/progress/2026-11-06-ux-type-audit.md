## Type audit (UX F1, branch feat/ui-type-audit)

- Lead F1: Inter + JetBrains Mono only, 400/500/600, the UI.md scale, tabular numbers, no faux styles, no leftover fonts. X6 (title 22/28, hero 44) landed in #123.
- Loading: already right. next/font self-hosts one variable file per face, `display: swap` is the default, and the metric-matched "Inter Fallback" is in the stack. No change; an e2e asserts the stack and that both faces load. Mono weights not pinned: a `weight` list would swap one variable file for two static ones.
- `html { font-synthesis: none }`. `font-variant-numeric: tabular-nums` on `[data-computed]`, `.font-mono`, `td`, `th`.
- New token `--text-section` 13/18. `Page.Section` h2, `Card` h3 and the Fix list "Tidy-ups" heading are Inter 500 13/18 (was 600 20/26). /app `Page` main and the /team document pane are `text-ui` (13/19), so table cells are 13px there (UI.md "UI body, table cells").
- HeroDemo: mono at 600 → 500 (2 spans). UI.md: "Inter 450" → 400 everywhere (no code rendered 450); loading/synthesis/tabular sentence updated. Logo test title said "Fraunces" → "Inter".
- Guard: tests/unit/ui/type-audit.test.ts fails on any font-bold/light/black/italic class, mono at 600, or a second font import.
- Render pass (16 surfaces × 2 themes × 375/1280). Left over, not in this PR: (1) the PNG export (`AuditImage`) renders in next/og's default font at weight 700, so it needs a bundled Inter TTF (follow-up F1b). (2) /audit keeps its landing-style sizes (display H1, 20px h2, 16px cells). (3) Chart axis labels scale with the SVG (about 18px at 1280, 7px at 375), which is X9b / plan PR 14. (4) The QuestionsView drawer title is still text-h3 600.
- X21: docs/qa/x21-rail-light-768.png and -1024.png show the black rail in light mode on tablets, for the founder.
