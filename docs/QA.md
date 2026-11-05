# QA

## Step 1: Supabase schema, seed, types, queries

Checked 2026-11-05 on commit a4c185b (branch step-1). DB work ran in the agent sandbox: lean local Supabase (`supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,mailpit,postgres-meta,supavisor`), then `supabase db reset`.
Preview: https://rank1-5qcmpw8q0-bryan-flowhighlevels-projects.vercel.app (Vercel API: git ref step-1, sha a4c185b, READY).

Result: PASS. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` | PASS. 10 files, 65 tests passed |
| `pnpm test:db` | PASS. 5 files (migrations, rls, limits, queries, seed), 159 tests passed |
| `pnpm typecheck` | PASS. exit 0 |
| `pnpm lint` | PASS. exit 0 |
| `pnpm e2e` (sandbox, `.next` deleted, fresh `next build`) | PASS. 14 passed |
| step 0 e2e on the step-1 preview (tests/e2e identical to main) | PASS. 14 passed |
| `supabase db reset` | PASS. "Finished supabase db reset on branch step-1" |

### Row counts after `supabase db reset`

| Table | Rows |
|---|---|
| workspaces | 1 ("Example Agency") |
| businesses | 1 ("Example Ramen House", Irvine, CA, ramen) |
| questions | 25 (25 active, 0 with empty short_text or long_text) |
| competitors | 5 (all "Example ...", 0 ratings) |
| runs | 2 weekly: 2026-10-26 partial 241 ok / 9 failed / 250, 2026-11-02 partial 245 / 5 / 250 |
| answers | 500 |
| citations | 697 |
| question_templates | 20 |
| local_places | 19 (13 landmarks incl. Eighteen Main, 6 areas) |
| fix_rules | 16 (R1-R15, H1; no A1-A6) |
| domain_categories | 5 |

After `pnpm db:seed:dev` (local only; the script refuses a non-local DB_URL): competitors 627 (622 hidden, source 'suggested'), local_places 40 (21 unverified clusters). runs 2, answers 500, citations 697 and fixes 0 are unchanged, so the dev seed adds no runs, answers or citations.

### TASKS.md step 1

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every table, index, RLS policy in SCHEMA.md; RLS on; service role only for engine writes, tokens, contact_requests | PASS | 22 of 22 SCHEMA.md tables exist with every listed column (script compared SCHEMA.md columns to information_schema: 0 missing). RLS on for 22 of 22. google_tokens, leads, contact_requests, stripe_events, fix_rules have 0 policies (service role only). 44 indexes. rls.test.ts: signed-in users cannot write runs, answers, citations, listing_snapshots, ai_traffic |
| 2 | seed.sql: Example Agency, Example Ramen House, 25 questions, 5 Example competitors, 2 weeks of runs with answers + citations, every brand starts with "Example" | PASS | row counts above; competitor names all "Example ..."; answers.brands only Example names (seed.test.ts) |
| 3 | 20 question_templates, Irvine local_places incl. Eighteen Main, fix_rules R1-R15 + H1, UNVERIFIED disabled, A1-A6 skipped | PASS | row counts above; spot-check (c) below |
| 4 | irvine_restaurants.csv without rating/review_count, loaded only by dev seed.dev.sql, no runs/answers for real names | PASS | CSV header has 11 columns, none rating or review; config.toml:72 `sql_paths = ["./seed.sql"]`; dev seed counts above |
| 5 | tests/fixtures/irvine.ts places (Eighteen Main, checked 2026-11-04), dietary, occasion lists; template test fills every template, <= 25 active | PASS | irvine.ts:10 IRVINE_PLACES, :24 Eighteen Main with 6 members and checked "2026-11-04", :45 DIETARY, :46 OCCASIONS; templates.test.ts "fills every template with no {slot} left", "has exactly 25 questions" passed |
| 6 | src/types/db.ts generated; typed queries for workspace, businesses, questions, latest run summary | PASS | fresh `supabase gen types typescript --local` is identical to src/types/db.ts; src/lib/queries workspaces.ts, businesses.ts, questions.ts, runs.ts; queries.test.ts 7 tests passed |
| 7 | RLS: user A cannot read or write user B's rows in any table | PASS | rls.test.ts: read, insert, update and delete denied for all 15 workspace-scoped tables, checked against service-role rows before and after; anon gets nothing from every relation; service-only and reference tables covered |
| 8 | test, test:db, typecheck, lint, e2e green locally; preview builds; step 0 e2e passes on it | PASS | commands above; preview READY, /dev/ui 200 |

### Spot checks

| Check | Result | Evidence |
|---|---|---|
| (a) No real CSV restaurant name in seed.sql, runs, answers, citations | PASS | 636 distinct CSV names, whole-word, case-insensitive: 0 hits in seed.sql, 0 in runs, 0 in the text, brands and question text of all 500 answers, 0 in the URL, domain and title of all 697 citations. The 6 Eighteen Main member names (irvine.ts): 0 hits in each |
| (b) No rating values in seeds or fixtures | PASS | CSV has no rating or review column. 27 source cells say "rating: web search result summary ..." (provenance text, no value; script checked for x.y, "n reviews", "stars"). competitors.rating non-null: 0 after db reset and after dev seed. seed.dev.sql inserts competitors (business_id, name, domain, source, hidden) only. "rating" in seed.sql appears only in fix_rules R4/R5 text copied from SCHEMA.md |
| (c) Disabled fix_rules have an UNVERIFIED item in SCHEMA.md 5b; enabled have none | PASS | Enabled: R10, R11, R14, H1. Their 5b rows contain no "UNVERIFIED". Disabled: R1-R7, R9, R12, R15 have UNVERIFIED in their detection or data source cells. R8 and R13 have it only in the why cell ("Resy share UNVERIFIED", "Lift UNVERIFIED"). They are disabled because their site: SERP keyword is the item R6 and R12 mark UNVERIFIED, and their `unverified` arrays say so (PROGRESS.md doc differences). That is the safe direction |
| (d) R/H customer_copy verbatim from SCHEMA.md | PASS | script compared column 6 of each 5b row to fix_rules.customer_copy: 16 of 16 exact matches |
| (e) No secrets in .next/static | PASS | fresh sandbox build, 20 files: no match for `sk_(test|live)_`, `whsec_`, `service_role`, `sb_secret_`, JWT `eyJhbGciOi`, `pplx-`, `re_`, `GOCSPX-`; no server-only env name from .env.example. src/lib/supabase/server.ts:1 imports "server-only" |
| (f) seed.dev.sql not in config.toml seed paths | PASS | supabase/config.toml:72 `sql_paths = ["./seed.sql"]`; seed.dev.sql is used only by scripts/seed-dev.mjs |
| DO NOT USE grep | PASS | no match in src |

Not blocking: PROGRESS.md says 656 citations, but db reset gives 697.

### Blocking problems

None.

## Step 0: Set up the project (final)

Checked 2026-11-05 on commit 26a1aef (branch step-0-claude-md).
Preview: https://rank1-oq7rbwrkg-bryan-flowhighlevels-projects.vercel.app (Vercel API: git ref step-0-claude-md, sha 26a1aef, READY).
Preview runs use VERCEL_AUTOMATION_BYPASS_SECRET from .env.local, sent as x-vercel-protection-bypass (playwright.config.ts).

Result: PASS. Every check passes locally and on the preview. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` | PASS. 7 files, 28 tests passed |
| `pnpm typecheck` | PASS. exit 0 |
| `pnpm lint` | PASS. exit 0 |
| `pnpm e2e` (local, `.next` deleted first, fresh `next build`) | PASS. 14 passed, 0 failed |
| `E2E_BASE_URL=<preview> pnpm e2e` | PASS. 14 passed, 0 failed |

Tests changed since the first run: tests/unit/tokens.test.ts changed only the errorBg value to #F7E6E3 (matches UI.md). New: tests/unit/ui/logo.test.tsx, tests/unit/example-data.test.ts, tests/e2e/logo.spec.ts, tests/e2e/dev-ui-example-data.spec.ts. 26a1aef adds one test to tests/e2e/dev-ui-example-data.spec.ts (Card demo is Example Ramen House, "34% of 160 answers" absent). No test deleted, skipped or weakened.

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
| No fake numbers | PASS | Every gallery number comes from example-data.ts. The Card demo is "Example Ramen House" with StatNumber 30%, "named in 75 of 250 answers" (exampleLeaderboard). The old hand-typed "34% of 160 answers" is gone (grep of page.tsx: no stat literals; new e2e assertion passed). Every example section is labeled Example data. Numbers in the Logo section are pixel sizes |
| Sample size + freshness shown | PASS | StatNumber "named in 9 of 30 answers"; Freshness "Checked 14 h ago · 250 answers · API-measured, directional" |
| /dev/ui hidden in production | PASS | production deployment rank1-i4qctuh3f (latest production): /dev/ui 404 |

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

None.
