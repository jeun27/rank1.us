# PROGRESS

## Step 0: Set up the project (done: qa PASS, docs/QA.md)
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
- Landing hero card copy ('34% of 160 answers, +6 pts') must be computed from example fixtures when the landing step is built: 55 of 160 floors to 34%.

## Step 1 (backend): schema, RLS, types, queries (branch step1-schema)
Changed
- supabase/migrations: 6 files, 22 tables, all with RLS on. 0001 tenancy (workspaces, workspace_members, businesses, competitors, questions + private.is_member / is_owner / is_business_member). 0002 reference (domain_categories, fix_rules, fix_rules_public view, question_templates, local_places). 0003 engine (runs, answers, citations, listing_snapshots, ai_traffic). 0004 work (fixes, experiments, experiment_questions, reports). 0005 service-only (google_tokens, leads, contact_requests, stripe_events). 0006 limits (25 active questions, seats triggers).
- supabase/rollbacks: one .down.sql per migration. tests/db/migrations.test.ts applies them in reverse on a fresh db, then re-applies the migrations.
- Billing fields: workspaces has ALL revoked from anon and authenticated. Signed-in users get SELECT, INSERT (name, owner_id) and UPDATE (name) only.
- src/types/db.ts is generated (`pnpm db:types`). src/lib/supabase/server.ts (server-only) and client.ts (browser). src/lib/queries: getCurrentWorkspace, listBusinesses, listQuestionsByBusiness, getLatestRunSummary. Each takes the caller's client.
- Tests: `pnpm test:db` runs tests/db/** against the local stack (`pnpm exec supabase start`; it runs `supabase db reset` itself). `pnpm test` stays Docker-free. Lean start: `pnpm exec supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,mailpit,postgres-meta,supavisor`.

Blocked/open
- Billing step must decide: checkout before business insert, or a seats grace. seats_quantity defaults to 0, so a new workspace cannot add a business until Stripe sets seats (spec kept literally).

Doc differences
- Migration order: reference tables come before engine and work tables because fixes.rule_key references fix_rules.
- PKs where SCHEMA.md has no id: workspace_members (workspace_id, user_id), experiment_questions (experiment_id, question_id), ai_traffic (business_id, date, source), google_tokens (business_id), domain_categories (domain).
- runs.business_id is nullable only for kind = 'free_audit'. answers.question_id is nullable and set to null when a question is deleted (question_text_used keeps the text). Without that, deleting a business with answers failed. free_audit runs, answers and citations have no member read path.
- Defaults the doc does not list: booleans (questions.active true, competitors.hidden false, contact_requests.emailed false, fix_rules.ai_lever true, fix_rules.enabled false), timestamps now(), arrays '{}', run job counts and cost 0, runs.status 'queued', fixes.status 'todo', questions.active_form 'short'.
- Extra checks: fix_rules.key pattern A1-A6/R1-R15/H1, H1 must have ai_lever false, rating 0-5, seats_quantity >= 0, leads.token unique. experiments.status, reports.status and citations.category are free text (no values listed).
- Limit triggers also cover activating a question, un-archiving a business and moving one to another workspace. They skip rows the caller has no access to, so RLS rejects those without revealing another workspace's counts.
- domain_categories has no write policy. Founder writes go through a server route that checks FOUNDER_EMAIL and uses the service role (Postgres cannot read app env vars).
- workspaces SELECT also allows owner_id = auth.uid() so INSERT ... RETURNING works before the owner member row is visible.
- Supabase's Next.js guide now names the browser key NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Kept NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.example, so there are no new env names.
- getLatestRunSummary picks the run with the newest started_at. A queued run with no started_at sorts last.

## Step 1 (data-pipeline): seed data (branch step1-seed)
Changed
- tests/fixtures/irvine_restaurants.csv: founder's 718 Irvine rows, trimmed to 11 columns (name, address, cluster, cuisine, website, enr_website, phone, chain_flag, google_status, checked_date, source). Ratings, review counts, emails, Instagram, pitch notes and enrichment columns dropped. Typed loader in tests/fixtures/irvine_restaurants.ts (own RFC 4180 parser, no new dependency).
- supabase/seed.sql (runs on every db reset) is generated by scripts/seed/generate.ts with a fixed RNG seed and hashed ids. Regenerate with `pnpm db:seed:gen`. tests/unit/seed.test.ts fails if the committed file drifts.
- Reference data: 20 question_templates (verbatim TEMPLATES), 19 Irvine local_places (verified, Eighteen Main as a landmark), 16 fix_rules (R1-R15, H1, parsed from SCHEMA.md 5b), 5 domain_categories for fake .test citation domains.
- Example data: owner@example.test auth user (no password, cannot sign in) owns Example Agency (seats_quantity 1, set before the business insert). Example Ramen House, 5 Example competitors, 25 questions, 2 weekly runs (2026-10-26, 2026-11-02) x 250 answers, 697 citations. Visibility 55 of 227 ok answers (24%) then 70 of 233 (30%), +6 pts.
- supabase/seed.dev.sql (dev only, not in config.toml): 622 CSV restaurants as hidden suggested competitors of Example Ramen House, ramen/Japanese first, and 21 CSV clusters as unverified landmarks. Apply with `pnpm db:seed:dev` (local DB only). It creates no runs, answers, citations or fixes.

Blocked/open
- fix_rules A1-A6 are not seeded. The founder will send them later.

Doc differences
- fix_rules enabled: R10, R11, R14, H1. All others are disabled, with their UNVERIFIED items in `unverified`. R8 and R13 are disabled too: they use the 'site:' SERP keyword that R6 and R12 mark UNVERIFIED. "Lift UNVERIFIED" in a why note does not disable a rule. Thresholds are seeded only where SCHEMA.md gives a number (R4, R5, R11, R12, R13). R12 and R13 are monthly, the rest weekly.
- Run job counts: jobs_ok = ok + no_overview answers (the call succeeded), jobs_failed = failed answers, jobs_total = 250. Week 1 is 241/9, week 2 is 245/5. Runs with failures have status 'partial'. Visibility still excludes failed and no_overview answers from the denominator.
- questions.template_key = the template's sort number as text (SCHEMA.md has no template key). dfs_location_code is left null rather than guessed.
- answers.brands shape: [{ "name", "position" }]. Answer text says "Example data" and lists only Example brands. raw = {"example_data": true}. cost_usd is 0 because there are no real calls.
- Dev seed dedupes CSV names case-insensitively (709 open rows become 622 competitors), so a chain is one competitor. Domain = website, else enr_website, as a hostname.
- tests/db/seed.test.ts runs its own db reset, because migrations.test.ts rolls back and re-applies migrations without the seed. resetDb() was added to tests/db/helpers.ts.
