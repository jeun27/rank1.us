# TASKS

## Step 0: Set up the project
- [x] 1. Next.js App Router app named rank1 (TypeScript strict, Tailwind, ESLint, pnpm). Vitest and Playwright added.
- [x] 2. CLAUDE.md (lead system prompt), TASKS.md, PROGRESS.md, HANDOFF.md, .env.example.
- [x] 3. .claude/agents/frontend.md, backend.md, data-pipeline.md, billing-auth.md, qa.md (build pack section 2).
- [x] 4. docs/UI.md (section 4), docs/COPY.md (all exact copy from section 4), docs/SCHEMA.md and docs/INTEGRATIONS.md (section 5), docs/AEO.md (section 6).
- [x] 5. src/styles/tokens.ts and Tailwind theme from docs/UI.md tokens. Fraunces (600), Public Sans (400, 600) via next/font/google. tabular-nums on numbers.
- [x] 6. src/components/ui: Button (primary jellyDeep/white, secondary text link, final-CTA amber/ink), Card, Badge (success/error/warn/info), Banner (error/info), Table, StatNumber, EmptyState, LoadingState (Jelly squish), Freshness ("checked X h ago · n answers").
- [x] 7. /dev/ui page shows every component and state. Deployed to a Vercel preview.

## Step 1 (data-pipeline): seed
- [x] Trimmed Irvine CSV fixture (718 rows, no rating/email/pitch columns) + typed loader.
- [x] supabase/seed.sql: templates verbatim, Irvine places, fix_rules R1-R15 + H1, Example Agency / Example Ramen House with 25 questions, 5 competitors, 2 weekly runs x 250 answers, citations on fake domains.
- [x] supabase/seed.dev.sql + `pnpm db:seed:dev`: CSV restaurants as hidden suggested competitors, clusters as unverified landmarks, no runs.
- [x] Tests: seed applies on db reset, templates verbatim, Example-only brands, 25 active questions, jobs counts = answer rows, visibility excludes failed/no_overview, no real names in seed.sql/runs/answers, seed.dev.sql creates zero runs.
