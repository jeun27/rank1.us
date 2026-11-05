# QA

## Step 0: Set up the project (re-run)

Checked 2026-11-05 on commit d864d72 (branch step-0-claude-md).
Preview: https://rank1-c5us4op76-bryan-flowhighlevels-projects.vercel.app (Vercel API: git ref step-0-claude-md, sha d864d72, READY).
Preview runs use VERCEL_AUTOMATION_BYPASS_SECRET from .env.local, sent as x-vercel-protection-bypass (playwright.config.ts).

Result: FAIL. 1 blocking problem, listed at the end. The axe failure from the first run is fixed.

### Commands

| Command | Result |
|---|---|
| `pnpm test` | PASS. 7 files, 28 tests passed |
| `pnpm typecheck` | PASS. exit 0 |
| `pnpm lint` | PASS. exit 0 |
| `pnpm e2e` (local, `.next` deleted first, fresh `next build`) | PASS. 12 passed, 0 failed |
| `E2E_BASE_URL=<preview> pnpm e2e` | PASS. 12 passed, 0 failed |

Tests changed since the first run: tests/unit/tokens.test.ts changed only the errorBg value to #F7E6E3 (matches UI.md). New: tests/unit/ui/logo.test.tsx, tests/unit/example-data.test.ts, tests/e2e/logo.spec.ts, tests/e2e/dev-ui-example-data.spec.ts. No test deleted, skipped or weakened.

### TASKS.md step 0

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Next.js App Router, TS strict, Tailwind, ESLint, pnpm, Vitest, Playwright | PASS | package.json; all commands above run |
| 2 | CLAUDE.md, TASKS.md, PROGRESS.md, HANDOFF.md, .env.example | PASS | files present in repo root |
| 3 | .claude/agents frontend, backend, data-pipeline, billing-auth, qa | PASS | all five present |
| 4 | docs/UI.md, COPY.md, SCHEMA.md, INTEGRATIONS.md, AEO.md | PASS | all five present |
| 5 | tokens.ts + Tailwind theme, Fraunces 600, Public Sans 400/600, tabular-nums | PASS | tokens.test.ts passed; e2e font and background assertions passed |
| 6 | Button, Card, Badge, Banner, Table, StatNumber, EmptyState, LoadingState, Freshness | PASS | tests/unit/ui passed |
| 7 | /dev/ui shows every component and state, deployed to a Vercel preview | PASS | dev-ui.spec.ts passed locally and on the preview; preview /dev/ui 200 |

### Standing checks (qa.md)

| Check | Result | Evidence |
|---|---|---|
| Copy matches docs/COPY.md | PASS | Customer strings are exact COPY.md strings. Logo wordmark "Rank1" matches the UI.md Logo row (Jeun 2026-11-05) |
| DO NOT USE grep | PASS | `grep -rniIE` over src and public for each AEO.md DO NOT USE item: no match |
| Axe accessibility | PASS | dev-ui.spec.ts axe assertion passed on mobile and desktop, locally and on the preview (errorBg #F7E6E3) |
| 375px has no horizontal scroll | PASS | preview: scrollWidth 375 at 375px, 1280 at 1280px |
| Tap targets >= 44px | PASS | dev-ui.spec.ts:28 passed, local and preview |
| No secrets in client bundle | PASS | Fresh local build (20 files in .next/static): no match for `sk_(test|live)_`, `whsec_`, `service_role`, JWT `eyJhbGciOi`, `pplx-`, `re_`, `GOCSPX-`; no server-only env name from .env.example; neither .env.local value present |
| No fake numbers | FAIL | Badge, Table, StatNumber, LoadingState and Freshness now use example-data.ts, and every section is labeled Example data (dev-ui-example-data.spec.ts passed). One string is still typed in: src/app/dev/ui/page.tsx:78 "Example data: named in 34% of 160 answers, +6 pts". The numbers in the Logo section (lines 50, 56) are pixel sizes, not stats |
| Sample size + freshness shown | PASS | StatNumber "named in 9 of 30 answers"; Freshness "Checked 14 h ago · 250 answers · API-measured, directional" |
| /dev/ui hidden in production | PASS | production deployment rank1-i4qctuh3f: /dev/ui 404 |

### Favicon (preview)

| Check | Result | Evidence |
|---|---|---|
| Head icon link loads /icon.svg with 200 | PASS | `/` and `/dev/ui` head: `<link rel="icon" href="/icon.svg?icon.02pnslip4xkyc.svg" sizes="any" type="image/svg+xml">`, which returns 200 image/svg+xml. /icon.svg returns 200 |
| Apple icon | PASS | `<link rel="apple-touch-icon" href="/apple-icon.png?...">` 180x180, 200 image/png |
| /favicon.ico returns 404 | PASS | 404; src/app/favicon.ico deleted; logo.spec.ts:23 passed |

### Screenshots (preview /dev/ui, full page)

- docs/qa/dev-ui-375.png
- docs/qa/dev-ui-1280.png

### Blocking problems

1. Hardcoded gallery numbers: src/app/dev/ui/page.tsx:78 ("34% of 160 answers, +6 pts") is not built from example-data.ts. It is the exact COPY.md hero card string and labeled Example data, but its numbers don't come from example-data.ts, which the gallery numbers rule requires.
