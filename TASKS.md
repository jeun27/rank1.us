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
- [x] 1. Migrations create every table, index and RLS policy in docs/SCHEMA.md. RLS on for every table; access by workspace membership; service role only for engine writes, tokens and contact_requests.
- [x] 2. supabase/seed.sql: workspace "Example Agency", business "Example Ramen House" (Irvine, CA, ramen), 25 restaurant questions (short + long) from the templates, 5 example competitors, 2 weeks of example runs with answers and citations. Every seeded brand name starts with "Example".
- [x] 3. Seed also loads question_templates (20, section 4b), local_places for Irvine, CA (landmarks + areas incl. Eighteen Main), fix_rules R1-R15 + H1 (UNVERIFIED rules enabled=false). A1-A6 skipped until Jeun sends them.
- [x] 4. tests/fixtures/irvine_restaurants.csv saved (rating and review_count dropped) and loaded by a dev-only supabase/seed.dev.sql (never production) as competitor candidates and cluster-tagged places. No runs, answers or visibility for real names.
- [x] 5. tests/fixtures/irvine.ts exports the places (incl. Eighteen Main cluster, checked 11/4/26), the {dietary} and {occasion} lists. A template test fills every template for Example Ramen House: no unfilled slots, <= 25 active questions.
- [x] 6. src/types/db.ts generated. Typed queries in src/lib/queries/ for current workspace, businesses list, questions, latest run summary.
- [x] 7. RLS test: user A cannot read or write user B's workspace rows in any table.
- [x] 8. pnpm test, pnpm test:db, typecheck, lint, pnpm e2e green locally; Vercel preview builds and step 0 e2e still passes on it.

### Step 1 (data-pipeline): seed
- [x] Trimmed Irvine CSV fixture (718 rows, no rating/email/pitch columns) + typed loader.
- [x] supabase/seed.sql: templates verbatim, Irvine places, fix_rules R1-R15 + H1, Example Agency / Example Ramen House with 25 questions, 5 competitors, 2 weekly runs x 250 answers, citations on fake domains.
- [x] supabase/seed.dev.sql + `pnpm db:seed:dev`: CSV restaurants as hidden suggested competitors, clusters as unverified landmarks, no runs.
- [x] Tests: seed applies on db reset, templates verbatim, Example-only brands, 25 active questions, jobs counts = answer rows, visibility excludes failed/no_overview, no real names in seed.sql/runs/answers, seed.dev.sql creates zero runs.

## Step 2: Public site, contact, legal, audit request (acceptance)
- [ ] 1. `/` is built from docs/UI.md "Landing page" with the exact copy in docs/COPY.md: 9 sections in order, a header (bar logo + "Rank1" wordmark), the footer and meta tags. Social proof sits behind SHOW_SOCIAL_PROOF=false.
- [ ] 2. Jelly: only the existing jelly asset. No new variants (worried, sleepy, SVG). Empty, loading and error states use the single existing Jelly.
- [ ] 3. /privacy and /terms are plain-language placeholders marked [LEGAL REVIEW NEEDED]. Privacy names Google sign-in, GA4 read-only access and data deletion on request.
- [ ] 4. Contact us has a /contact page and a modal. The tier select offers Agency bundle, Done-for-you (custom) and Other, with NO dollar amounts.
- [ ] 5. POST /api/contact: honeypot, Cloudflare Turnstile, a rate limit of 3 per IP hash per hour, a row stored in contact_requests, and an email through Resend to CONTACT_TO_EMAIL from CONTACT_FROM_EMAIL. No address is hard-coded.
- [ ] 6. The free-audit CTA posts to /api/audit/request (a stub; step 7 runs the audit).
- [ ] 7. The Final Button Set (PR #3) is the source of truth for every component. The copy says weekly checks + monthly report everywhere.
- [ ] 8. pnpm test, pnpm test:db, typecheck, lint and pnpm e2e are green locally. The Vercel preview builds, and the e2e passes on it.

## Team workspace: Profound-style 3-pane shell (issue #10)
- [x] 1. /team behind ENABLE_TEAM_WORKSPACE=true (404 otherwise), in .env.example.
- [x] 2. Sidebar: business name, Workspace | Analytics, the 9 screens, Recents, help, theme toggle, collapse.
- [x] 3. Context pane: stored facts with sample size + freshness + "API-measured, directional"; Copy context (Markdown brief) and Open in Claude. No model calls.
- [x] 4. Document pane: tabs that close, add, expand and split; roving tablist, Delete, Esc.
- [x] 5. Light (Field Notes) and dark tokens, every text pair AA; theme, split and collapse persist in localStorage.
- [x] 6. Below 768px: one pane with a Nav / Context / Document tab bar. 150-200ms motion, off for reduced motion.
- [x] 7. Unit, DB and e2e tests at 375 and 1280 in light and dark, axe clean.

## Step 5 (frontend): restaurant onboarding at /app/onboarding (issue #18)
- [x] 1. 3 steps (Business, Competitors, Questions + location) per UI.md 4b, every state, exact COPY.md strings.
- [x] 2. Business: domain (DomainField), name, cuisine select, Irvine, CA prefilled, landmark/area picks (max 3 each), dietary, occasion.
- [x] 3. Competitors: 5 pre-ticked rows (name, rating, domain), manual add/remove, partial/empty/error states.
- [x] 4. Questions: up to 25 template rows, short + long form, track toggle, location level with ChatGPT/Gemini greyed below country.
- [ ] 5. Finish setup calls createBusinessOnboarding, then /app (waits on feat/step5-onboarding-db).
- [ ] 6. Site read and Maps lookup through readSite / findLocalCompetitors (waits on feat/step5-onboarding-engines).
- [ ] 7. e2e at 375 and 1280 (axe, keyboard, sign in to DB rows) green in CI; visuals for each state.

## Step 7 (frontend): audit progress, results and exports (issue #33)
- [x] 1. /app/runs/[runId] (member only) and /audit/[token] (unknown token 404), with Audit progress (polling every 5 s) and Audit results per UI.md 4b.
- [x] 2. Free page: paywall card to /signin?next=/app/billing and the Powered by Rank1 credit; never on paid.
- [x] 3. export.csv and export.png (next/og) for both, as no-store attachments.
- [x] 4. /audit/*: no-referrer, noindex/nofollow, noreferrer cited links, no lead email.
- [x] 5. /dev/audit gallery, e2e at 375 and 1280 (axe, keyboard), visuals per state.

## Step 8 (frontend): self-serve shell and pages (issue #37)
- [x] 1. /app nav (existing pages only) and full-width pages, light only.
- [x] 2. Dashboard, Competitors (SoV only here), Questions (drawer), History: every UI.md 4b state, mobile included.
- [x] 3. /dev/app gallery; e2e at 375 and 1280 (axe, keyboard, one H1, no side scroll, nav); visuals per state.
