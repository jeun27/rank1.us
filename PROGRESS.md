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
