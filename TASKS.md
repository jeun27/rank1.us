# TASKS

## Step 0: Set up the project
- [x] 1. Next.js App Router app named rank1 (TypeScript strict, Tailwind, ESLint, pnpm). Vitest and Playwright added.
- [x] 2. CLAUDE.md (lead system prompt), TASKS.md, PROGRESS.md, HANDOFF.md, .env.example.
- [x] 3. .claude/agents/frontend.md, backend.md, data-pipeline.md, billing-auth.md, qa.md (build pack section 2).
- [x] 4. docs/UI.md (section 4), docs/COPY.md (all exact copy from section 4), docs/SCHEMA.md and docs/INTEGRATIONS.md (section 5), docs/AEO.md (section 6).
- [x] 5. src/styles/tokens.ts and Tailwind theme from docs/UI.md tokens. Fraunces (600), Public Sans (400, 600) via next/font/google. tabular-nums on numbers.
- [x] 6. src/components/ui: Button (primary jellyDeep/white, secondary text link, final-CTA amber/ink), Card, Badge (success/error/warn/info), Banner (error/info), Table, StatNumber, EmptyState, LoadingState (Jelly squish), Freshness ("checked X h ago · n answers").
- [x] 7. /dev/ui page shows every component and state. Deployed to a Vercel preview.

## Step 1: Supabase schema, seed, types, queries (acceptance)
- [ ] 1. Migrations create every table, index and RLS policy in docs/SCHEMA.md. RLS on for every table; access by workspace membership; service role only for engine writes, tokens and contact_requests.
- [ ] 2. supabase/seed.sql: workspace "Example Agency", business "Example Ramen House" (Irvine, CA, ramen), 25 restaurant questions (short + long) from the templates, 5 example competitors, 2 weeks of example runs with answers and citations. Every seeded brand name starts with "Example".
- [ ] 3. Seed also loads question_templates (20, section 4b), local_places for Irvine, CA (landmarks + areas incl. Eighteen Main), fix_rules R1-R15 + H1 (UNVERIFIED rules enabled=false). A1-A6 skipped until Jeun sends them.
- [ ] 4. tests/fixtures/irvine_restaurants.csv saved (rating and review_count dropped) and loaded by a dev-only supabase/seed.dev.sql (never production) as competitor candidates and cluster-tagged places. No runs, answers or visibility for real names.
- [ ] 5. tests/fixtures/irvine.ts exports the places (incl. Eighteen Main cluster, checked 11/4/26), the {dietary} and {occasion} lists. A template test fills every template for Example Ramen House: no unfilled slots, <= 25 active questions.
- [ ] 6. src/types/db.ts generated. Typed queries in src/lib/queries/ for current workspace, businesses list, questions, latest run summary.
- [ ] 7. RLS test: user A cannot read or write user B's workspace rows in any table.
- [ ] 8. pnpm test, pnpm test:db, typecheck, lint, pnpm e2e green locally; Vercel preview builds and step 0 e2e still passes on it.

### Step 1 (data-pipeline): seed
- [x] Trimmed Irvine CSV fixture (718 rows, no rating/email/pitch columns) + typed loader.
- [x] supabase/seed.sql: templates verbatim, Irvine places, fix_rules R1-R15 + H1, Example Agency / Example Ramen House with 25 questions, 5 competitors, 2 weekly runs x 250 answers, citations on fake domains.
- [x] supabase/seed.dev.sql + `pnpm db:seed:dev`: CSV restaurants as hidden suggested competitors, clusters as unverified landmarks, no runs.
- [x] Tests: seed applies on db reset, templates verbatim, Example-only brands, 25 active questions, jobs counts = answer rows, visibility excludes failed/no_overview, no real names in seed.sql/runs/answers, seed.dev.sql creates zero runs.
