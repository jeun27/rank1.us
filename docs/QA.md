# QA

## Step 0: Set up the project

Checked 2026-11-05 on commit 090017d (branch step-0-claude-md).
Preview: https://rank1-62blztem2-bryan-flowhighlevels-projects.vercel.app (Vercel says target preview, git ref step-0-claude-md, sha 090017d).
Preview runs use VERCEL_AUTOMATION_BYPASS_SECRET from .env.local, sent as x-vercel-protection-bypass (playwright.config.ts).

Result: FAIL. 2 blocking problems, listed at the end.

### Commands

| Command | Result |
|---|---|
| `pnpm test` | PASS. 5 files, 24 tests passed |
| `pnpm typecheck` | PASS. exit 0 |
| `pnpm lint` | PASS. exit 0 |
| `pnpm e2e` (local, fresh `next build`) | FAIL. 4 passed, 2 failed: `dev-ui.spec.ts:4` on mobile and desktop, axe `color-contrast: .bg-errorBg.text-brick.px-2, .px-4.bg-errorBg.text-brick > .flex-1` |
| `E2E_BASE_URL=<preview> pnpm e2e` | FAIL. Same 4 passed, same 2 failed, same axe violation |

In both failing runs every assertion before the axe line passed: one H1, all 9 section headings, paper background rgb(247, 244, 238), Fraunces on H1, Public Sans on body, scrollWidth <= viewport.

### TASKS.md step 0

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Next.js App Router, TS strict, Tailwind, ESLint, pnpm, Vitest, Playwright | PASS | package.json (next 16.4.5, vitest, @playwright/test); all four commands above run |
| 2 | CLAUDE.md, TASKS.md, PROGRESS.md, HANDOFF.md, .env.example | PASS | files present in repo root |
| 3 | .claude/agents frontend, backend, data-pipeline, billing-auth, qa | PASS | `ls .claude/agents` shows all five |
| 4 | docs/UI.md, COPY.md, SCHEMA.md, INTEGRATIONS.md, AEO.md | PASS | `ls docs` shows all five |
| 5 | tokens.ts + Tailwind theme, Fraunces 600, Public Sans 400/600, tabular-nums | PASS | tests/unit/tokens.test.ts 4 passed; e2e font and background assertions passed; `tabular-nums` in StatNumber, Freshness, Badge, LoadingState |
| 6 | Button, Card, Badge, Banner, Table, StatNumber, EmptyState, LoadingState, Freshness | PASS | tests/unit/ui 20 tests passed |
| 7 | /dev/ui shows every component and state, deployed to a Vercel preview | FAIL | Page renders and is deployed (preview /dev/ui 200 with bypass, 302 without). Its own e2e test fails on axe, see A11y below |

### Standing checks (qa.md)

| Check | Result | Evidence |
|---|---|---|
| Copy matches docs/COPY.md | PASS | Customer strings on /dev/ui and / are exact COPY.md strings (hero H1, meta title and description, error banner, city tooltip, empty state, loading message, partial badge, "Add business", "Opening Google…"). Section names and "UI components" are gallery labels on a page that 404s in production |
| DO NOT USE grep | PASS | `grep -rniE` over src for each AEO.md DO NOT USE item: no text matches (only a binary hit inside public/jelly.png) |
| Axe accessibility | FAIL | color-contrast on error Badge and error Banner: errorBg #F6E4E1 with brick #B3443A is 4.495:1, under 4.5:1. Known; token fix waits on Jeun |
| 375px has no horizontal scroll | PASS | preview: scrollWidth 375 at 375px, 1280 at 1280px; e2e scroll assertion passed on mobile locally and on preview |
| Tap targets >= 44px | PASS | `dev-ui.spec.ts:28` passed on both projects, local and preview |
| No secrets in client bundle | PASS | After the local build (19 files in .next/static): no match for `sk_(test|live)_`, `whsec_`, `service_role`, JWT `eyJhbGciOi`, `pplx-`, `re_`, `GOCSPX-`; no server-only env name from .env.example; neither .env.local value present |
| No fake numbers | FAIL | Gallery numbers must come from src/app/dev/ui/example-data.ts. Leaderboard, StatNumber and Freshness do. These are typed into page.tsx instead: line 53 "34% of 160 answers, +6 pts", line 59 "+6 pts", line 61 "230 of 250 answers", line 112 "120 of 250 answers". Lines 59, 61 and 112 have no "Example data" label of their own |
| Sample size + freshness shown | PASS | StatNumber shows "named in 9 of 30 answers"; Freshness "Checked 14 h ago · 250 answers · API-measured, directional" under the table and in its own section |
| /dev/ui hidden in production | PASS | production deployment rank1-i4qctuh3f: /dev/ui 404, / 200 |

### Screenshots (preview /dev/ui, full page)

- docs/qa/dev-ui-375.png
- docs/qa/dev-ui-1280.png

### Blocking problems

1. Axe color-contrast fails on the error Badge and error Banner. src/components/ui/Badge.tsx:5 and src/components/ui/Banner.tsx:11 use bg-errorBg + text-brick (4.495:1). Token choice is with Jeun.
2. Hardcoded gallery numbers not from example-data.ts: src/app/dev/ui/page.tsx:53, :59, :61, :112.
