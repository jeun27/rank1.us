# PROGRESS

## Step 0: Set up the project (in progress)
Changed
- Created private repo jeun27/rank1.us. Next.js 16.4.5 app with TypeScript strict, Tailwind v4, ESLint, pnpm. Vitest + Testing Library + Playwright + axe.
- CLAUDE.md, the five .claude/agents files, TASKS.md, PROGRESS.md, HANDOFF.md, .env.example (every name from docs/INTEGRATIONS.md, one-line comment each).
- docs/: UI.md and AEO.md are sections 4 and 6 verbatim. COPY.md holds the copy rows of section 4, copied by line range, not retyped. SCHEMA.md and INTEGRATIONS.md split section 5.
- src/styles/tokens.ts + Tailwind @theme (default palette removed, so only UI.md colors exist). Fraunces 600 + Public Sans 400/600 via next/font/google.
- src/components/ui: Button, Card, Badge, Banner, Table, StatNumber, EmptyState, LoadingState, Freshness, Jelly. /dev/ui gallery (404 when VERCEL_ENV=production).
- public/jelly.png: background removed from jelly-01-front.jpg (512 x 471). UI.md lists this as a step 2 task; done now because LoadingState and Banner need Jelly.

Blocked
- Nothing. errorBg changed to #F7E6E3 (brick text 4.57:1, approved).

Doc differences
- Next.js 16 ships its own AGENTS.md telling agents to read node_modules/next/dist/docs before writing code. Kept as is.
- Tailwind v4 has no tailwind.config.js. The theme is the @theme block in src/app/globals.css; tests/unit/tokens.test.ts fails if it drifts from tokens.ts.
- CLAUDE.md says "commit after every green step". Jeun's PR rules say never push to main. Each step is committed on its own branch and merged through a PR.
- Freshness follows UI.md exactly ("Checked 14 h ago · 250 answers · API-measured, directional"), not the shorter step 0 wording. Under 1 h shows "min", 48 h and over shows "d".
- Percentages are rounded down (2 of 3 = 66%), so a stat is never shown higher than measured.
- Jelly is a single raster with no separate eyes, so: no blink in the loading squish, no eye direction, no worried expression. All wait for jelly.svg.
- /dev/ui is a gallery, so it shows several primary buttons and several Jellys. Real screens keep one of each.
- Logo (Jeun, 2026-11-05): header = bar mark + "Rank1" wordmark, favicon = bar app icon instead of UI.md's Jelly drop. CLAUDE.md product bullet and UI.md Favicon row updated, Logo row added. Default Next.js favicon.ico removed.
