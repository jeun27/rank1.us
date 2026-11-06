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
- CLAUDE.md (now docs/PRODUCT.md) says "commit after every green step". Jeun's PR rules say never push to main. Each step is committed on its own branch and merged through a PR.
- Freshness follows UI.md exactly ("Checked 14 h ago · 250 answers · API-measured, directional"), not the shorter step 0 wording. Under 1 h shows "min", 48 h and over shows "d".
- Percentages are rounded down (2 of 3 = 66%), so a stat is never shown higher than measured.
- Jelly is a single raster with no separate eyes, so: no blink in the loading squish, no eye direction, no worried expression. All wait for jelly.svg.
- /dev/ui is a gallery, so it shows several primary buttons and several Jellys. Real screens keep one of each.
- Logo (Jeun, 2026-11-05): header = bar mark + "Rank1" wordmark, favicon = bar app icon instead of UI.md's Jelly drop. docs/PRODUCT.md (was CLAUDE.md) product bullet and UI.md Favicon row updated, Logo row added. Default Next.js favicon.ico removed.
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

## Components v2: Final set (branch components-v2)
Changed
- Jeun adopted the "Final set" component design (2026-11-05). docs/PRODUCT.md (was CLAUDE.md) `<design>`, docs/UI.md (tokens, shape/shadow/gradient tokens, Components table, contrast notes) and docs/COPY.md (Final set strings) record it.
- Tokens: white, jellyLoading, fieldBorder, auroraAmber, auroraTeal; radius surface 24, banner 28; 7 shadow tokens; the aurora gradient. tokens.ts and the @theme block stay in sync (tokens.test.ts).
- src/components/ui: Button (pill primary, loading, disabled with lock, secondary link with arrow), Card, Banner, Freshness, EmptyState, LoadingState updated. New: DomainField, AuroraButton, ProgressBar, Icon (inline lucide SVG paths, no icon library).
- /dev/ui: new sections for DomainField, AuroraButton and ProgressBar, plus a "Final set" layout like the design. Screenshots: docs/qa/components-v2-375.png, docs/qa/components-v2-1280.png.

Doc differences
- Rule change (Jeun 2026-11-05): primary buttons and fields are pills. Before: radius 8, pills only for badges.
- Rule change (Jeun 2026-11-05): soft shadows from the shadow tokens only. Before: no drop shadows.
- Rule change (Jeun 2026-11-05): one gradient, the aurora ring on the Google sign-in button. Before: no gradients.
- Final set difference: the design file uses Open Sans and Space Grotesk. Kept Public Sans and Fraunces (docs/PRODUCT.md product spec, was CLAUDE.md).
- Final set difference: the design file fills buttons, fields, banners and cards with faint gradients (#2667DD→#1A5AC4, white→near-white). They are solid jellyDeep / white, so the aurora stays the only gradient.
- Final set difference: loading button is solid jellyLoading #316FC5 (white 4.99:1), not jellyDeep at 85% opacity (4.29:1).
- Final set difference: field edge is fieldBorder ink 50% (3.18:1, WCAG 1.4.11), not ink 10% (1.22:1).
- Final set difference: the disabled pill keeps inkMuted at 75% opacity (3.45:1). WCAG 1.4.3 exempts disabled controls; it is a real `<button disabled>`.
- Final set difference: the error banner Jelly is 64px (UI.md), not the design's 56px.
- COPY.md gained "Your domain" as the screen-reader label of the domain input (from the final CTA form's "your domain" field). The design has no visible label.
- The loading copy "Checking 4 AI engines… 120 of 250 answers" is now shown in two parts: the message, and "120 of 250 answers" under the bar. progressLabel() in example-data.ts is no longer used by /dev/ui.
- Final set difference: the design has no mobile layout. Below a 21rem field width the Field + Button stacks (button full width under the input, radius 28) so the typed domain is not cut off at 375px.

Changed test assertions (old → new; none removed)
- button.test "primary": `rounded-card`, `not rounded-full`, `h-11` → `rounded-full`, `h-12`, `shadow-button`, `bg-jellyDeep`, `text-white`, `not rounded-card`.
- button.test "secondary": `not bg-` → `not bg-|shadow`, plus an aria-hidden arrow icon after the label.
- button.test "loading": label "Opening Google…" → "Checking…" (Opening Google… moved to AuroraButton), plus `bg-jellyLoading`, `rounded-full`, `not bg-jellyDeep` and a spinner with `motion-reduce:animate-none`.
- tokens.test "exact color values": 14 colors → 19 (adds white, jellyLoading, fieldBorder, auroraAmber, auroraTeal).
- tokens.test "removes the default palette": declared = colors + "white" → declared = colors (white is now a token).
- tokens.test "no dark mode, gradients or shadows" → two tests: "exact radius + 7 shadow tokens, no other --shadow-*, no raw box-shadow" and "no dark mode, the only gradients are the aurora token and the ring's solid white padding layer". New: components use no arbitrary shadows or gradients, and only AuroraButton uses `aurora-ring`.
- badge-banner-card "Banner error": `bg-errorBg`, `text-brick` → `bg-white`, `border-[1.5px]`, `border-brick`, `text-brick`, `rounded-banner`, `shadow-banner-error`, `not bg-errorBg`, action link is jellyDeep.
- badge-banner-card "Banner info": `bg-infoBg`, `text-jellyDeep` → `bg-white`, `border-[1.5px]`, `border-jellyDeep`, `text-jellyDeep`, `rounded-banner`, `shadow-field`, `not bg-infoBg`, `infoBg` round icon chip.
- badge-banner-card "Card": `bg-paper`, `border`, `border-border`, `rounded-card`, `not shadow` → `bg-white`, `rounded-surface`, `shadow-card`, `not border|bg-paper|rounded-card`.
- states.test "EmptyState": exactly one link → exactly one submit button named "Add my business", a labeled "Your domain" input, no links.
- states.test "LoadingState": one-line "Checking 4 AI engines… 120 of 250 answers" → "Checking 4 AI engines…" + "120 of 250 answers" + computed "48%" + progressbar aria-valuenow 120, and the spinner also stops for reduced motion.
- e2e dev-ui: heading list adds DomainField, AuroraButton, ProgressBar, Final set; heading lookup is now `exact: true` ("Button" also matched "AuroraButton").
- e2e dev-ui-example-data: Example data label list adds DomainField, ProgressBar, Final set.
- New tests: tests/unit/ui/final-set.test.tsx (DomainField 4 states, AuroraButton, ProgressBar math and 0/0, Freshness clock); e2e reduced motion, Final set computed styles (focus ring, aurora, #316FC5, 48% fill), narrow/wide field layout.

## Step 2a: landing page (branch step2-landing)
Changed
- `/` is the full landing page: header, the 9 sections in docs/UI.md 4a order, footer and a sticky mobile CTA. Components are in src/components/site; fixtures are in src/components/site/example-data.ts.
- The hero card numbers are computed from fixtures (55 of 160 = 34% floor; 45 of 160 last week, so +6 pts). The screenshot tabs are static mocks built from StatNumber/Table/Freshness and fixtures.
- Social proof renders only when SHOW_SOCIAL_PROOF === "true" (read at build time; the page is static).
- Tests: tests/unit/site/landing.test.tsx and tests/e2e/landing.spec.ts. Screenshots: docs/qa/landing-before-{375,1280}.png, docs/qa/landing-after-{375,1280}.png.

Doc differences / decisions
- Lead 2026-11-05 (G1): feature card bodies render COPY.md's exact phrases as bullet lists. FAQ answers are the exact phrases, capitalized with a closing period. No other words change.
- Lead 2026-11-05 (G2): mock panel headers were added to COPY.md under "Mock panel headers (lead, 2026-11-05)".
- Lead 2026-11-05 (G3): the comparison corner cell is an empty <td>, and row labels are <th scope="row">.
- Feature cards have no section H2 in COPY.md, so the section is labeled "Features" for screen readers only and each card title is an H2.
- The sticky bar's bottom padding (80px below md) is always reserved instead of only while the bar shows. This avoids a layout jump when the bar toggles and keeps the footer clear either way.
- The COPY.md e2e check compares lowercased text with curly quotes straightened and a trailing period ignored. Fixture values (brands, numbers, questions) are marked data-computed and skipped.

Known gaps
- "Start for $99/mo" links to /sign-in, which doesn't exist yet (auth step).
- OG image is [PLACEHOLDER], so og:image is omitted until a real image exists.
- Merged origin/step2-forms (366ebf4). #audit renders AuditRequestForm, and every Contact us link is a ContactUsLink. The e2e tests mock /api/audit/request. step2-forms (4137697) is now merged into step-2, so the /api routes, /contact, /privacy and /terms are included.

## Step 2b (billing-auth): forms, contact, legal pages (branch step2-forms)
Changed
- AuditRequestForm (src/components/forms) and ContactUsLink + ContactForm (src/components/contact). The modal is a native `<dialog>` with a Tab trap, Esc to close and focus back on the link. It is full screen below md, and without JS the link goes to /contact.
- POST /api/contact runs validate, honeypot (200, nothing stored), Turnstile siteverify with remoteip, then 3 per IP hash per rolling hour counted from contact_requests (429 on the 4th). It then inserts the row and sends through Resend, and sets emailed=true only after Resend returns 2xx. A Resend failure keeps the row and returns 502.
- POST /api/audit/request (stub) runs the same validation, honeypot and Turnstile. AUDIT_DAILY_LIMIT caps leads per UTC day across all visitors (lead, 2026-11-05: spend cap, no per-IP limit). It inserts a leads row (normalized domain, ip_hash, random token) and returns 202 `{ status: "queued" }`.
- /contact, /privacy and /terms (placeholders marked [LEGAL REVIEW NEEDED], with a last-updated date). /dev/forms previews AuditRequestForm on the ink band until the landing page hosts it (hidden in production like /dev/ui).
- Queries: insertContactRequest, countRecentContactRequests, markContactRequestEmailed (contactRequests.ts), insertLead, countLeadsSince (leads.ts). src/lib/supabase/service.ts holds the service-role client.
- New env name: IP_HASH_SALT (.env.example). The e2e build gets Cloudflare's public Turnstile test keys and a canary salt (playwright.config.ts webServer.env). tests/e2e/client-secrets.spec.ts greps .next/static for server-only names and values.
- Vitest aliases `server-only` to an empty stub (tests/stubs) so tests can import route handlers.

Doc differences
- Next 16 with cacheComponents rejects `export const runtime = "nodejs"`, so the routes rely on the default Node.js runtime (comment in each route).
- Brick field-error text fails contrast on the ink band. In AuditRequestForm the inline error is paper colored (the band's text color), the input keeps the 2px brick edge as an extra cue, and aria-invalid + aria-describedby carry the meaning, so color is not the only signal. The Banner stays white/brick (lead OK, 2026-11-05).
- DomainField is unchanged (lead). AuditRequestForm uses its pill look through PillField with plain inputs and the "final" Button.
- Validation is hand-rolled (src/lib/spam/validate.ts), shared by the browser and the routes. No new dependency.
- Company is optional in the Contact form (contact_requests.company is nullable) and has no error: the input caps it at 100 characters and the server cuts anything longer. Name, Email, Tier and Message are required.
- Form strings live in src/components/forms/copy.ts. tests/unit/forms/copy.test.ts fails on any [PLACEHOLDER] there, and on any string that is not in docs/COPY.md.

## Step 2 (backend): industry + fix list visibility migration
Changed
- Migration 20261105000007 (+ .down.sql). contact_requests gets `industry` (NOT NULL; one of Restaurant, HVAC, Plumbing, Roofing, Pest control, Other; the 'Other' backfill default is dropped) and `industry_other` (max 60 chars, only allowed with Other). businesses gets `service` ('self_serve' default | 'dfy') and `fix_list_visible` (default false).
- service and fix_list_visible are service-role only. businesses now has explicit column grants for INSERT and UPDATE, like the workspaces billing fields, so any new businesses column must be added to those grants to be member-writable.
- fixes SELECT for members = member AND (service = 'self_serve' OR fix_list_visible). The old FOR ALL policy is split into select/insert/update/delete, because a FOR ALL policy also grants SELECT. fix_rules_public is unchanged.
- insertContactRequest takes ContactRequestInsert: industry is one of INDUSTRIES, and industry_other is only allowed with "Other". INDUSTRIES and INDUSTRY_OTHER_MAX are exported from src/lib/queries/contactRequests.ts.
- Tests: tests/db/step2-migration.test.ts. The rls.test.ts contact_requests fixture now sets industry.

Blocked/open
- A staff role arrives with the team UX step. Until then "the team always sees the fix list" means the Rank1 team reads through the service role / admin path.
- POST /api/contact and the Contact form must send industry (+ industry_other). Until they do, the route fails typecheck and every contact insert hits the NOT NULL check (HANDOFF.md).

## Release gate (PR #5)
- Merged is not live (Jeun 2026-11-05): main deploys are disabled in vercel.json; releases are tagged and deployed on request.
- Removed `not.toBe(false)` in tests/unit/vercel-config.test.ts: the `Object.keys(...)` toEqual `["main"]` check already fails if deploymentEnabled is `false`.

## Step 3 (backend): user roles + self-serve workspace bootstrap (branch feat/step3-roles, issue #12)
- Step 3 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.
- Migration 20261105000008 (+ .down.sql): `user_roles` (team | dfy_client; no row = self-serve; readable only by self; service role writes). `ensure_self_serve_workspace()` returns the caller's workspace, or creates one with the caller as owner on first sign-in, behind a per-user advisory lock. Team and dfy_client get null. `my_landing()` returns team | dfy_client | onboarding | dashboard. Both are executable by authenticated only (anon EXECUTE revoked).
- Queries: ensureSelfServeWorkspace, getLanding (src/lib/queries/auth.ts). Tests: tests/db/roles.test.ts.
- Open: auto-created workspaces start at seats_quantity 0, so onboarding cannot insert a business until checkout. Lead settles this in Step 5.

## Step 3 (billing-auth): sign in + role routing (branch feat/step3-auth, issue #12)
- Step 3 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.

Changed
- `src/proxy.ts` (Next 16 renamed middleware.ts to proxy.ts) + `src/lib/supabase/middleware.ts`: refreshes the session with getClaims on every non-static request, keeps the no-store cache headers, and sends signed-out `/app`, `/team` and `/client` visitors to `/signin?next=<path>`.
- `/signin`: "Continue with Google" (primary, full width) and an email magic link (secondary). Strings are in COPY.md "Auth (lead, 2026-11-05)".
- `/auth/callback`: Google returns `?code` (PKCE exchange). Email links are `?token_hash&type` (magiclink, signup or email) checked with verifyOtp, so they work in another browser or on another device. No code and no token_hash (for example tokens in a #fragment), or a failed check, shows the expired-link banner, never the Google one. The hosted email templates are in HANDOFF.md (lead applies them).
- The magic-link form sends `emailRedirectTo = <origin>/auth/callback` with no query string, and first POSTs next to `/auth/next`. That stores it in a 10-minute httpOnly SameSite=Lax cookie (`rank1_next`, path /auth, same safeNext check), which the callback reads once and clears. Then ensureSelfServeWorkspace → getLanding → team `/team`, dfy_client `/client`, onboarding `/app/onboarding`, dashboard `/app`. `next` is honored only when it's a same-origin path in the user's own area or a public page.
- `POST /auth/signout` and the Account menu (details/summary, works without JS) on the /app and /client headers and in #11's workspace sidebar (new `user` icon).
- Role gates (AreaGate in the /app and /client layouts and the /team page): `/app` is for self-serve owners and members, `/team` for team and `/client` for dfy_client. A wrong role goes to its own home (review of #14).
- Without NEXT_PUBLIC_SUPABASE_URL and the anon key (Supabase not connected on Vercel yet), the proxy passes public pages through and still sends the app areas to /signin, instead of every page returning 500 (review of #14).
- "Continue with Google" is the AuroraButton (UI.md "Aurora button": the one gradient, Google sign-in only), including 'Opening Google…'. The magic-link submit stays secondary (QA, PR #17).
- `/auth/callback` and `POST /auth/signout` redirect to `/signin?error=config` instead of an empty 500 when the Supabase env is missing. /signin then shows "Sign-in isn't available right now. Try again in a few minutes." (lead, COPY.md Auth).
- Local-stack e2e (10 in auth.spec.ts, all of team-workspace.spec.ts) skip when E2E_BASE_URL is set ("needs local Supabase", same pattern as client-secrets.spec.ts). The 10 public auth checks still run on a preview (QA, PR #17).
- `POST /auth/next` has the same same-origin check as sign out (shared `isSameOrigin`), so another site can't plant a next for the user.
- `/auth/callback` rejects `type=invite` on purpose. Step 12 (client invites) adds invite links and must add `invite` to EMAIL_TYPES then (lead, 2026-11-05).
- `POST /auth/signout` accepts only same-origin requests (Sec-Fetch-Site, or else Origin), so another site's form can't sign a user out.
- `/team` (#11's workspace): team role only. Signed out goes to /signin, and any other role goes to its own home. With ENABLE_TEAM_WORKSPACE off, a team user gets the placeholder.
- Landing: "Start for $99/mo" → `/signin?next=/app/billing` (was a 404 to /sign-in). Header "Log in" → `/signin`. `/app/billing` is the paywall stub: the Pricing card, the button disabled, "Checkout isn't open yet."
- Placeholders with one H1 + the Dashboard EmptyState: `/app`, `/app/onboarding`, `/client`.
- e2e (tests/e2e/auth.spec.ts) sign in through the admin generateLink API on the local stack (no Mailpit). The CI e2e job now starts lean Supabase, and playwright.config.ts reads the local keys from `supabase status`.

Blocked/open
- Hosted Google provider is OFF. Until Jeun turns it on, the Google button shows the error banner (it checks /auth/v1/settings first, because Auth answers a disabled provider with raw JSON).
- Auth e2e run on the local build only (they need the local service-role key). "Google works on preview" is a manual check after the steps below.

Google Cloud console steps (for Jeun, sign-in only, no GA4 scopes yet)
1. https://console.cloud.google.com → pick or create the Rank1 project.
2. Google Auth Platform → Branding: app name "Rank1", your support email, authorized domains `rank1.us` and `supabase.co`.
3. Audience: External. While it's in Testing, add the test Google accounts. Data access: only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
4. Clients → Create client → Web application. Authorized JavaScript origins: `https://rank1.us`, `http://localhost:3000`. Authorized redirect URI: `https://yqllnopnwlqspnbqgwfh.supabase.co/auth/v1/callback`.
5. Copy the client ID and secret into Supabase → Authentication → Sign In / Providers → Google, and enable it. Never put them in the repo or .env files.
6. Check it: open a Vercel preview → Log in → Continue with Google → you land on /app/onboarding (new) or /app.

Intended behavior changes (lead, 2026-11-05), not loosened tests
- Removed tests/unit/auth/team-gate.test.tsx: its team-only cases are covered by tests/unit/auth/area-gate.test.tsx (every role × area allow/redirect pair); no coverage lost.
- tests/e2e/team-workspace.spec.ts: `/app` returned 404 and now sends signed-out visitors to `/signin?next=%2Fapp`. Its `/team` visits now sign in a seeded team user first.
- tests/unit/workspace/gate.test.ts → gate.test.tsx: with the flag off (the same 5 values) /team was a 404 and now shows the placeholder to a team user. "true" still renders the workspace.
- tests/e2e/landing.spec.ts: "Start for $99/mo" pointed at `/sign-in` (a known 404) and now points at `/signin?next=/app/billing`.

Doc differences
- The brief says `middleware.ts`. Next 16 calls it `proxy.ts` (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md), so that's the file.
- Cache Components is on, so /signin reads its query inside Suspense (the frame prerenders).
- `supabase/config.toml`: added `http://localhost:3000/**` to additional_redirect_urls so local email links can come back to localhost.

## Team workspace shell (frontend, branch feat/team-workspace, issue #10)
Changed
- /team: 3-pane team workspace like Profound's Wrenfield demo (sidebar 240px, context and document panes split 50/50 by a keyboard-resizable divider). Example data only (Example Ramen House seed), read-only. Off unless ENABLE_TEAM_WORKSPACE=true.
- src/lib/queries/workspace.ts: getWorkspaceRows (read-only, takes a DbClient) and buildWorkspace (every count from stored answers and citations). tests/db/workspace.test.ts checks the DB rows build the same view as /team's Example data.
- scripts/seed/data.ts: the pure part of scripts/seed/generate.ts (no file reads), so /team can import the seed rows. seed.sql and seed.dev.sql are unchanged (seed.test.ts still passes).
- Dark theme tokens (src/styles/tokens.ts darkColors, globals.css [data-theme="dark"]). Same token names, so the Final set components switch with it. New token `raised` (selected rows, active tab, composer).
- src/lib/workspace/context.ts: per-selection facts and the Markdown brief. src/lib/workspace/prefs.ts: theme, split and collapse in localStorage key rank1.workspace.

Blocked
- Nothing. Preview needs ENABLE_TEAM_WORKSPACE=true set in Vercel (Preview environment) by the lead.

Doc differences
- Dark mode: docs/PRODUCT.md and UI.md said "dark mode: not in v1" / "Light mode only". Jeun's locks (ENG_HANDOFF_OVERNIGHT §3, ENG_HANDOFF_STEP2 §3: "light + dark; team nav always dark") override that for /team, so both docs now scope the rule to customer pages. Dark applies only through data-theme; there is still no prefers-color-scheme CSS.
- Route: Step 3 routing reserves /app for self-serve owners/members, /team for the team, /client for DFY clients. The workspace moved from /app to /team; /app is a 404 until the owner app exists.
- "Open in Claude": claude.ai has no documented prefill parameter. `https://claude.ai/new?q=<brief>` is the known form, but one report says it no longer prefills, and claude.ai blocks headless checks behind a Cloudflare challenge, so it is unverified. The button copies the brief to the clipboard first, then opens ?q= (no ?q= when the encoded brief is over 6000 characters), and says "Brief copied. Paste it in Claude if the box is empty."
- Fix list, Experiments and Reports show their 4b empty states: the seed has no fixes, experiments or reports (fixes come from the fix_rules engine later). The Reports document previews the dashboard summary.
- Clipboard blocked: both buttons show "Couldn't copy. Allow clipboard access and try again." instead of failing silently (review note on #11).
- The business switcher shows the name only: UI.md hides the switcher while the workspace has 1 business.
- Tailwind v4 inlines theme shadows into utilities, so the light shadows also render in dark (the inset white highlight is subtle on dark surfaces). The workspace itself uses borders, not shadows.

## Step 4 (data-pipeline): engine adapters with fixtures (branch feat/step4-engines, issue #15)
Step 4 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.

Changed
- src/lib/engines: types.ts (EngineId, EngineRequest, EngineAnswer), chatgpt.ts, gemini.ts (both via llm-scraper.ts), google-aio.ts, perplexity.ts, dataforseo.ts (basic auth, status_code 20000, 130 s timeout), shared.ts, index.ts (runEngine with injectable fetch/env/clock). No LLM calls, no SDKs: plain fetch.
- tests/fixtures/engines: docs example responses copied unedited (README lists URL + fetch date per file) plus synthetic files marked "synthetic" (Example brands, example.test URLs only).
- `pnpm smoke:engines`: prints "skipped: no keys" and exits 0 without keys. With keys, 5 questions x 1 run per engine, printing only status, ms and cost.
- .env.example: PERPLEXITY_MODEL (optional).

Blocked/open
- /admin/test waits for PR #14 (Step 3 auth) to merge.
- PERPLEXITY_MODEL default = perplexity/sonar from models.md ("Perplexity's grounded search model"); UNVERIFIED that it matches what perplexity.ai users get; Jeun to confirm.

Doc differences
- Perplexity endpoint: the docs (agent-api/quickstart.md, tools/web-search.md) use POST https://api.perplexity.ai/v1/agent; INTEGRATIONS.md says /agent/responses. Followed the docs.
- Perplexity user_location.region uses the full state name ("California"), as in INTEGRATIONS.md and the web-search docs' field description.
- ChatGPT/Gemini citations = result.sources (the cited links). result.search_results (ChatGPT) are search hits, not citations, and are not used.
- AIO citations = ai_overview.references; if absent, the elements' references. Inline items[].links are not counted as citations.
- AIO location: location_code when the question has dfs_location_code, else location_name in the docs' format ("Irvine,California,United States"); country level uses 2840.

UNVERIFIED (handled defensively: missing fields give null text, no citations or null cost, never a throw)
- Perplexity: model name (above); error response body shape (any non-null `error` or a `status` other than "completed" = failed; a missing status is accepted, as in the docs' response-shape example); timeout (ours: 60 s); usage.cost.total_cost as the full charge.
- DataForSEO: tasks[0].cost as the full per-call charge; ChatGPT/Gemini city effect (treated as country); force_web_search on Gemini (not sent); live-call duration for AIO with load_async_ai_overview.
- Country support: only US has a location code (2840) and name; other countries return failed.

Review follow-ups (lead, 2026-11-05)
- The repo is public, so the ChatGPT and AIO docs examples (real NYC cafés with phones and addresses; real local businesses, hotels, reviews, jobs) are replaced by synthetic files with the docs' exact JSON structure and field names: Example brands, example.test URLs, null phone/address fields. The Gemini and Perplexity docs examples are generic (no local businesses, phones or emails) and stay verbatim. tests/unit/engines/fixtures-privacy.test.ts guards this.
- Perplexity reports 'exact' only when the requested level was sent in user_location (a city goes only with its region). Otherwise 'fallback_country'.
- Citations are not deduped in the adapters: they keep every returned link in order. Dedupe happens at scoring (Step 6/7).
- docs/COPY.md "Admin (lead, 2026-11-05)" holds the /admin/test strings. The page is built after #14 merges.

## Step 5 (backend): seat rule, onboarding RPCs, team fix-list access (branch feat/step5-onboarding-db, issue #18)
- Step 5 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.
- Lead decision: UI.md's Billing row has an "Unpaid: 'Start for $99/mo'" state, so a workspace with seats_quantity = 0 may hold exactly one active business. Otherwise active self-serve businesses stay below seats_quantity. Checks don't run for unpaid workspaces (Steps 6/13). DFY businesses (service = 'dfy') are created by the team, are exempt from the seat limit and don't take a seat. The seat trigger also fires on a service change, so dfy → self_serve can't bypass it. tests/db/limits.test.ts "seats 0 cannot add a business" now encodes this rule (first allowed, second blocked).
- Migration 20261105000009 (+ .down.sql). `create_business_onboarding(p jsonb)` is SECURITY INVOKER (lead OK): RLS, the businesses column grants and both limit triggers apply. It runs in one transaction, uses the caller's own workspace, and reads only the listed fields. `create_dfy_client(p jsonb)` is team-only, SECURITY DEFINER: it creates a workspace owned by the team caller and a business with service 'dfy', fix_list_visible false.
- Fixes (closes #9): members of a business read its fixes when it is self-serve, fix_list_visible is on, or they are on the team. They write only when it is self-serve or they are on the team. A dfy_client never writes fixes.
- Queries: createBusinessOnboarding, createDfyClient, getOnboardingState (onboarding.ts), listLocalPlaces (places.ts, verified only). Tests: tests/db/onboarding.test.ts.
- Local DB tests run on a separate stack: in your own clone, set supabase/config.toml project_id (e.g. rank1-backend) and ports 55xxx, then `git update-index --skip-worktree supabase/config.toml` so it never gets committed.
- create_business_onboarding and create_dfy_client validate input and raise 22023 with a clear message. Business: name, domain, city, state and country are required. name ≤ 200, domain a valid hostname ≤ 253, city/state/country ≤ 100, cuisine ≤ 60. Each question needs a short form, and both forms are ≤ 500. Each competitor needs a name ≤ 200, and its domain must be a valid hostname or empty. The DFY workspace_name is ≤ 200.
- Business domain is required (lead): onboarding is domain-first ("Add your domain and I'll find the questions"), and readSite needs it. Competitor domain is optional, because Maps results can lack a website: missing, null or blank is stored as NULL and validated only when present.
- Open: src/types/db.ts got the two 0009 functions added by hand in the generator format, because the pod disk was full and no local stack could run. Regenerate it with `pnpm db:types` in the next DB PR when a stack is available.
- Open (Step 11/12 decision): a DFY workspace is owned by the team member who created it, so only that member (and anyone added to workspace_members) reaches it through RLS. Whether every team user sees every DFY client is still to decide.

## Step 5 (backend): per-user rate limits for onboarding lookups (branch feat/step5-rate-limits, issue #18)
- Migration 20261105000010 (+ .down.sql). `rate_events` (user_id, kind read_site | maps_lookup, created_at) has RLS on and no policies. `take_rate_token(kind)` is SECURITY DEFINER with the limits fixed in SQL so callers can't raise them: read_site 10 per hour, maps_lookup 5 per hour and 20 per 24 hours. It takes a per-user, per-kind advisory lock, prunes that user's events of the kind older than 24 h, and records one event only when allowed. An unknown kind raises 22023. No user returns false. EXECUTE is for authenticated only.
- `lookup_cache` (user_id, kind, key, result jsonb, created_at; PK user_id+kind+key) is service-role only (RLS on, no policies, revoked from anon/authenticated). It's the 24 h result cache, so repeating a lookup (Back/Next) takes no token. Queries on the service client: getCachedLookup(db, userId, kind, key, maxAgeSeconds), and putCachedLookup(db, row) as an upsert that restarts the age (src/lib/queries/lookup-cache.ts).
- Query: takeRateToken(db, kind) in src/lib/queries/rate-limits.ts. Tests: tests/db/rate-limits.test.ts.
- src/types/db.ts got rate_events and take_rate_token added by hand in the generator format (no local stack, disk full). Regenerate it with `pnpm db:types` in the next DB PR.

## Step 4 (data-pipeline): /admin/test founder engine test page (branch feat/admin-engine-test, refs #15)
Changed
- /admin/test: form (engine, question, location level; Irvine, CA) that calls runEngine server-side through a server action and shows status, answer, cited links, location and cost. Raw vendor JSON stays on the server. Copy from docs/COPY.md "Admin (lead, 2026-11-05)". Run test is disabled while engine keys are missing.
- Gate: proxy (src/lib/supabase/middleware.ts) rewrites /admin/** to a 404 for anyone whose verified email isn't FOUNDER_EMAIL, unset included, so the status is a real 404. The page and its server action also call requireFounder() (getUser() via the Step 3 server client) and notFound().
- Engines: DATAFORSEO_API_URL / PERPLEXITY_API_URL optional base-URL overrides (e2e points them at tests/e2e/helpers/fake-engines.mjs, which serves the fixtures). stateName() returns undefined for unknown state codes (reviewer note on #16), so Perplexity falls back and AIO fails instead of sending a guess.

Doc differences
- Next 16 streams pages with a 200 first, so notFound() inside the page can't set a 404 status (node_modules/next/dist/docs, loading.md "Status codes"). The real 404 comes from Proxy, as those docs recommend. The page sets `instant = false` because it reads the session at request time.
- e2e signs the founder in with magic links. Only one link per user is valid, and both viewport projects sign in at once, so the founder test retries up to 5 times.
- QA (#22) fix: the proxy matched the raw pathname, so /%61dmin/test and /admin%2Ftest reached the page (soft 404 with status 200). The proxy now matches a normalized path (src/lib/auth/path.ts): segments percent-decoded up to 3 times and re-split on decoded slashes/backslashes, empty and "." segments dropped, ".." resolved, lowercased. Malformed encoding → 404. The same check covers Step 3's /app, /team and /client sign-in redirect.

## Step 5 (data-pipeline): Maps competitors, readSite, question suggestions (branch feat/step5-onboarding-engines, issue #18)
Step 5 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.
Lead decision (Step 5 brief): a workspace with seats_quantity = 0 may hold exactly one active business (UI.md Billing "Unpaid: 'Start for $99/mo'"); checks don't run for unpaid workspaces (Steps 6/13); DFY businesses are exempt from the seat limit. Implemented by backend in #20.

Changed
- src/lib/onboarding: the fixed contract (types.ts) the onboarding UI builds against. readSite(domain), findLocalCompetitors({cuisine, city, state, domain?}), suggestQuestions({business, picks}) (wraps buildQuestions, ≤25), CUISINES (template fixed_cuisine values first, then common ones).
- src/lib/engines/maps.ts: DataForSEO Google Maps SERP live/advanced. keyword '{cuisine} restaurant', location_name "Irvine,California,United States", language_code en, depth 20. maps_search items → {title, domain, rating (rating.value), category, cid}, field names from the docs page. Missing keys → 'missing_keys', other failures → 'error'; never throws.
- findLocalCompetitors: the first 5 in Maps order (no re-ranking), skipping items without a cid and the business's own domain (www/scheme/case ignored).
- readSite: robots.txt first (a Rank1 group wins over *, longest match, Allow wins ties), then home + /menu; 10 s timeout each, User-Agent "Rank1/1.0 (+https://rank1.us)", 1 MB cap. Name = og:site_name, else the <title> before its first separator. Cuisine = the CUISINES entry named most often (whole words, scripts/styles stripped), ties by list order. No LLM.
- SSRF guard (user-supplied domain fetched by our server): hostnames only (no IP literals, localhost, .local/.internal and similar), every hop's DNS answers must be public (no loopback/private/link-local/CGNAT/v6 local), and only same-site redirects (www, http/https) are followed, max 3.
- Fixtures: maps/synthetic-maps-live-advanced.json (structure from the docs example, which names real places with addresses) and maps/synthetic-irvine-ramen.json (Example brands). Both are covered by the privacy test.
- `pnpm smoke:maps`: ≤5 Maps calls, only with keys, printing status/ms/count. `pnpm smoke:engines` now runs only the engines smoke file.

UNVERIFIED / open
- Maps: depth 20 (docs: billed per SERP of up to 100 results, so 20 costs the same as 100); rating as an object with `value` (docs example: rating_type Max5, value, votes_count); whether domain is always the bare host.
- readSite: DNS is checked before each request but the fetch resolves again, so a DNS-rebinding race remains. Closing it needs a pinned-IP agent; logged for Step 6+.
- The 'unknown state code' fix in stateName() is in #19. maps.ts uses the state table directly, so it doesn't depend on #19.
- Review (#23) fixes: readSite reads at most 1 MB. A larger Content-Length is refused unread, and a stream is aborted as soon as it passes the cap; both count as unreadable. isPrivateAddress parses IPv6 fully, so v4-mapped in hex form (::ffff:7f00:1), NAT64 (64:ff9b::/96), 2001:db8::/32 and 192.0.0.0/24 are blocked too.
- Test widened, with reason: tests/unit/engines/fixtures-privacy.test.ts now allows `(www\.)?example-[a-z0-9-]+\.test` links (it was `example-[a-z0-9]+\.test`). The Maps fixtures need hyphenated Example brand hosts (example-ramen-house.test) and a www form to test own-domain exclusion. Only example-*.test hosts are allowed, as before. Net tightening in the same test: the docs-URL exception now applies only inside the `_synthetic` note (it used to apply anywhere in the file), every synthetic file must carry that note, and title/name/source_name fields in synthetic files must start with "Example".
- admin-test.spec.ts: the 2 local-stack tests (service-role founder seeding) now skip when E2E_BASE_URL is set (preview runs), same as auth.spec.ts; public admin checks still run on previews. CI runs them in full (QA #28).

## Step 5 (frontend): restaurant onboarding (branch feat/step5-onboarding, issue #18)
Step 5 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.

Changed
- src/app/app/onboarding: Onboarding.tsx (client, 3 steps, step in ?step= so the browser Back walks the steps), contract.ts (the types agreed with backend and data-pipeline), copy.ts.
- /dev/onboarding: every 4b onboarding state with Example data (404 in production, like /dev/ui), for visuals and axe.
- DomainField takes an optional onSubmit (client forms). LoadingState's progress bar is optional (one lookup has nothing to count).

Doc differences
- "Type 3 things you sell" (unreadable site): the three answers are shown and kept for the session but not saved. Neither the RPC nor SCHEMA.md has a field for them; the cuisine select is still required.
- Questions are saved with active_form 'long' (Step 5 brief). Location level defaults to city; ChatGPT and Gemini show the UI.md tooltip copy at city and state level.
- Local Supabase is off (pod disk full, lead 2026-11-05): DB-backed e2e (tests/e2e/onboarding.spec.ts) is gated by CI.
- The server actions (readSite, findLocalCompetitors) run only for a signed-in user, and the browser never gets DataForSEO's raw error text (review on #23).
- Lookup limits (lead, 2026-11-05): per signed-in self-serve owner, readSite 10/hour and Maps 5/hour + 20/24 h (take_rate_token, #24). Over the limit the actions return the existing fallbacks. Identical ok lookups (same domain, or same cuisine + city + state) come from lookup_cache for 24 h with no token taken. The cache is written with the service client, so users can't forge results.

## Step 6 (backend): run jobs and orchestration RPCs (branch feat/step6-run-jobs, issue #25)
- Step 6 built from ENG_HANDOFF_OVERNIGHT §6 + CLAUDE.md + docs/*; Build Pack not readable; reconcile later.
- Lead decisions:
  - Queue = the documented fallback, a Supabase jobs table polled by Vercel Cron. No Vercel Queues in v1.
  - Runs need subscription_status active/trialing or a DFY business. free_audit is Step 7.
  - Citations are deduped by normalized URL per answer at storage time. The worker normalizes, and unique(answer_id, url) is the safety net.
  - One queued/running run per business (P0409).
  - Spend cap (review): kind 'weekly' is service role only (the Step 13 cron). A member may start one 'audit' per business per rolling 24 h, counted from runs.started_at, failed runs excluded (P0429 audit_limit). The service role isn't capped.
  - Question deleted mid-run (review): its jobs cascade away, and an AFTER DELETE trigger recomputes the run from the remaining jobs. jobs_total = remaining jobs. The run closes once none are queued/running. finish_job on a deleted job is a no-op. The deleted question's answers stay (question_id set null) but no longer count in the run's totals. Open for Step 8: visibility queries should also exclude answers with a null question_id (or join to run_jobs) so they match jobs_ok.
  - Stale-job exhaustion writes a failed answer.
  - Run counts are recomputed from answers on every finish, never incremented, because Vercel Cron may deliver twice.
- Cron (lead, 2026-11-05): the team is on Vercel Pro, so `* * * * *` is allowed. Crons run only on production, and production updates only on a release tag, so no paid engine calls happen until Jeun's next release AND the API keys exist. The cron route and vercel.json ship in the data-pipeline PR with processJob.
- Migration 20261105000011 (+ .down.sql):
  - run_jobs: RLS on, ALL revoked from anon/authenticated, unique(run_id, question_id, engine, run_index).
  - create_run(business, kind): definer, member or service role.
    - Errors: 42501 not allowed (incl. a member asking for weekly), P0402 subscription_required, P0409 run_in_progress, P0429 audit_limit, 22023 bad kind / archived / no active questions.
    - Errors: 42501 not allowed, P0402 subscription_required, P0409 run_in_progress, 22023 bad kind / archived / no active questions.
    - Jobs: 10 per active question, 3/3/3/1.
  - claim_jobs(limit), service only: FOR UPDATE SKIP LOCKED. A job locked over 10 minutes ago is re-claimable. At 3 attempts it's closed as failed with a failed answer.
  - finish_job(job, answer, citations), service only, idempotent. It stores the answer and citations, closes the job and recomputes the run: jobs_ok = ok + no_overview, jobs_failed = failed, cost_usd, then running / complete / partial / failed and finished_at.
  - job_error(job, text), service only, sets run_jobs.last_error.
- Contract: src/lib/runs/types.ts (ClaimedJob, FinishAnswer, FinishCitation). Wrappers: createRun / claimJobs / finishJob / recordJobError in src/lib/queries/run-jobs.ts. Tests: tests/db/run-jobs.test.ts.
- New env name RUN_JOBS_BATCH (.env.example). CRON_SECRET was already there. The lead sets CRON_SECRET in Vercel.
- src/types/db.ts got run_jobs and the five functions added by hand in the generator format (no local stack). Regenerate it with `pnpm db:types` in the next DB PR.
- tests/db/helpers.ts resetDb(): after `db reset` it sends `notify pgrst, 'reload schema'` and waits (every 250 ms, 30 s max) until `GET /rest/v1/businesses?limit=0` returns 200, failing with the last status. It used to return as soon as PostgREST answered, before the schema reload, so tests/db/workspace.test.ts failed with "Could not find the table … in the schema cache" (main CI 57c0000, a7e6d31).

## Step 6 (data-pipeline): job worker, mention detection, citation categories (branch feat/step6-worker)
Step 6 built from ENG_HANDOFF_OVERNIGHT §6 + CLAUDE.md + docs/*; Build Pack not readable; reconcile later.
Lead decisions (Step 6 brief): queue = the documented fallback (a Supabase jobs table polled by Vercel Cron; no Vercel Queues in v1). audit/weekly runs only for subscription_status active/trialing or DFY businesses (free_audit is Step 7). Citations are deduped by normalized URL per answer at storage time.

Changed
- src/lib/runs/process-job.ts: processJob(job, {db, runEngine}) runs the engine, maps the answer (mentions for ok answers only; failed/no_overview keep mentioned/brands/first_position null; failed raw = {error, response}), dedupes and categorizes the citations, and calls finish_job. It never throws. If finish_job errors, the job stays running for claim_jobs to re-claim, and the error is recorded with backend's job_error RPC (recordJobError). A failed answer passes `error`, which finish_job stores in run_jobs.last_error, and raw null (no vendor error bodies in answers.raw, which members can read). Unknown cost stays null, never 0. Types come from backend's contract (src/lib/runs/types.ts); serviceRunsDb wraps src/lib/queries/run-jobs.ts plus manual domain_categories rows.
- src/lib/runs/mentions.ts: detectMentions(text, brands), no LLM. NFKD with diacritics stripped, case-folded, quotes unified, "&" folded to "and". Names and aliases match as whole words (a possessive 's matches). Bare domain, plus the label without TLD when it's ≥5 chars and not all stoplist words. Overlapping hits go to the longest match. position = 1-based order of first appearance among mentioned brands.
- src/lib/runs/categorize.ts: rules → reddit, youtube, social, review_directory (user-review/listing sites and delivery apps), news_blog (editorial guides such as Eater, The Infatuation, Michelin Guide and Zagat, news outlets, blog hosts and /blog paths), else other. A manual domain_categories row wins, subdomains included.
- src/lib/runs/citations.ts: dedupe by normalized URL (lowercase scheme and host, no trailing slash, no utm_*, no #fragment, since AIO references carry #:~:text= anchors). First occurrence kept, positions renumbered 1..n.

UNVERIFIED
- The category domain lists and the mention stoplist are ours, not from any docs. The editorial vs listing split follows fix rules R12 vs R6/R7.
- Ownership (lead, 2026-11-05): data-pipeline also owns the cron route and vercel.json crons. src/lib/runs/drain.ts: cronAuthorized (exact `Bearer ${CRON_SECRET}`, unset or blank secret → reject, per the Vercel Cron docs "Securing cron jobs"), batchSize (RUN_JOBS_BATCH, default 20, max 100), drainJobs (claims 5 at a time, processes each chunk in parallel, stops at the batch, an empty queue, or a 150 s budget, since live calls run up to ~130 s). vercel.json crons: /api/cron/run-jobs every minute. src/app/api/cron/run-jobs/route.ts: GET → 401 unless the header matches; claim_jobs failing → 500 with a short error; maxDuration 300 (cacheComponents rejects the `dynamic` segment config, and reading request headers already makes it dynamic). The team is on Vercel Pro; crons run on production only, which updates only at release.

## Step 7 (backend): free audit jobs and result queries (branch feat/step7-free-audit-db, issue #33)
- Step 7 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.
- Lead decisions:
  - A free audit has no business row. Its jobs carry the question and location inline, and its brand list (site name or domain + up to 5 Maps competitors) is a service-only snapshot, reached only via the lead token, server-side.
  - Inputs come without an LLM (readSite, Irvine CA defaults, findLocalCompetitors top 5, buildQuestions).
  - AUDIT_DAILY_LIMIT caps leads per UTC day, and no keys means every job fails cleanly.
  - Paid metrics count only answers with question_id not null. Free-audit answers all count.
  - One Resend email per lead when the run ends complete/partial. Metrics are pure TypeScript.
  - Free-audit jobs are claimed first (bounded by 5 audits/day = 1,250 jobs/day), so a same-day audit doesn't wait behind weekly runs.
  - Notify state: notified_at / notify_sent / notify_attempts. Failed runs are marked once with sent=false, and a Resend outage stops after 5 tries.
- Migration 20261105000012 (+ .down.sql):
  - runs unique(id, kind). run_jobs.run_kind, backfilled, with FK (run_id, run_kind) → runs(id, kind). CHECK: free_audit ⇔ question_id null ⇔ inline question_text + location_level + country present.
  - answers.job_id → run_jobs (on delete set null, backfilled, unique). recompute_run now joins answers to jobs by job_id, because free-audit answers have no question_id.
  - free_audits (service only).
  - create_free_audit(p jsonb): service only, validates (22023), idempotent per lead. One transaction: run + 3/3/3/1 jobs + snapshot + leads.run_id.
  - create_run, recompute_run, complete_job and claim_jobs are redefined (the rollback restores the 0011 bodies).
- Queries (src/lib/queries/results.ts):
  - getRunResults (members, audit/weekly). getFreeAuditByToken (service, never returns email or token).
  - getPreviousRun (audit/weekly, complete/partial).
  - listUnnotifiedFreeAudits / markFreeAuditNotified / bumpFreeAuditNotifyAttempts.
  - ClaimedJob.question.id is now string | null.
- Tests: tests/db/free-audit.test.ts.
- src/types/db.ts got the 0012 objects added by hand in the generator format (no local stack). Regenerate it with `pnpm db:types` when a stack is available.

## Step 7 (data-pipeline): metrics, CSV, free-audit pipeline (branch feat/step7-metrics)
Step 7 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.
Lead decisions (Step 7 brief): a free audit has no business row; its brand list is a service-only snapshot reached by the lead token. Inputs are readSite → findLocalCompetitors → buildQuestions, with no LLM. AUDIT_DAILY_LIMIT caps leads, and the audit starts only after the lead row is stored. Paid-run metrics count only answers whose question still exists. One email per lead (idempotency key = lead id, from CONTACT_FROM_EMAIL). Metrics are pure TypeScript.
- Free-audit default picks (lead, 2026-11-05), reconcile with Build Pack: verified local_places only, kind then name order (listLocalPlaces), the first 3 landmarks + first 3 areas, dietary vegan/vegetarian, occasion date night, ≤25 via buildQuestions. With no cuisine found, {cuisine} = "restaurants" (lead) and Maps searches plain "restaurant". Questions use the long form (as onboarding stores active_form 'long'), at city level.
- Notify (lead Q3): every finished free audit is marked handled (notified_at, notify_sent; failed → sent=false, no email). A failed send bumps notify_attempts; sends cap at 5. With NEXT_PUBLIC_SITE_URL or CONTACT_FROM_EMAIL unset, notify skips with one log line and no attempt counted. Log lines never carry an email, token or domain.

Changed
- src/lib/metrics/compute.ts: computeMetrics returns Metric {value, numerator, denominator} everywhere (.claude/agents/data-pipeline.md). Visibility overall and per engine; leaderboard {metric, change in floored whole points vs the previous run, tooFew n < 10}, sorted by value, numerator, business first, name; share of voice (each brand once per answer; null at 0 mentions); top sources by domain; jobs (ok includes no_overview); freshness.
- src/lib/metrics/csv.ts: one row per answer, RFC 4180 with CRLF; cells starting with = + - @ tab CR get a leading ' (OWASP CSV injection).
- src/lib/audit/start.ts and notify.ts, plus docs/COPY.md "Audit email (lead, 2026-11-05)".
- src/lib/onboarding/competitors.ts: the Maps keyword is trimmed, so an empty cuisine searches "restaurant".
- Wiring (after #34 / 0012): src/lib/audit/service.ts binds the real dependencies on the service client: create_free_audit via rpc (p = {lead_id, business {name|null, domain}, competitors ≤5, location, questions}); listUnnotifiedFreeAudits, markFreeAuditNotified and bumpFreeAuditNotifyAttempts from src/lib/queries/results.ts (okAnswers is the email's {n}). POST /api/audit/request calls after(() => startFreeAuditWith(db, {id, domain})) once insertLead returns, so the 202 and the copy are unchanged. GET /api/cron/run-jobs runs notifyFreeAuditsWith after each drain and returns `notified` alongside the drain summary.

## Step 8 (backend): self-serve shell queries (branch feat/step8-shell-queries, issue #37)
- Step 8 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.
- Lead decisions:
  - /app nav: Dashboard, Competitors, Questions, History, Billing (only pages that exist). Full width, light mode.
  - Current business = the workspace's oldest active business (switcher in Step 14). Latest run = the newest complete/partial audit or weekly run, with change vs getPreviousRun. Free audits never appear in /app.
  - SoV only on Competitors. The Dashboard has visibility, per engine, top-5 leaderboard, top 3 fixes, freshness and the 8-run line (hidden under 2 runs).
  - Top fixes are read from `fixes` only, never fix_rules.why_note.
  - Suggested competitors = findLocalCompetitors minus tracked and dismissed. "Not a competitor" stores the row hidden (source 'suggested').
  - The Questions page is read-only. History lists every audit/weekly run. No page triggers runs.
  - Run summaries are left to RLS. /client (Step 12) decides what DFY clients see.
- Migration 20261105000013 (+ .down.sql), additive and re-runnable in one transaction:
  - businesses.created_at, so the oldest business has an order. Existing rows get the migration time, with ties by id.
  - competitors writes (insert/update/delete) only for self-serve businesses or the team (a dfy_client never writes). Members still read.
  - run_summaries(business, limit): SECURITY INVOKER, using computeMetrics' exclusions (ok, question_id not null, named = mentioned).
  - add_competitor / dismiss_competitor: invoker RPCs with a per-business lock. They match by domain, else name, un-hide on re-add, are idempotent on dismiss, and validate with 22023.
- Queries (src/lib/queries/shell.ts): getCurrentBusiness (self_serve only), listRunSummaries, getTopFixes, getQuestionsWithLatestAnswers, listCompetitors, addCompetitor, dismissSuggestion. Tests: tests/db/shell.test.ts, including the parity test against computeMetrics.
- src/types/db.ts got the 0013 objects added by hand in the generator format (no local stack). Regenerate it with `pnpm db:types` when a stack is available.

## Step 7 (frontend): audit progress, results and exports (branch feat/step7-audit, issue #33)
- /app/runs/[runId] (members, through RLS getRunResults) and /audit/[token] (service role, getFreeAuditByToken) share AuditView: UI.md 4b Audit progress and Audit results. The free page adds the 'Start for $99/mo' card and the Powered by Rank1 credit; the paid page never shows the credit.
- Per-engine progress comes from run.jobs_total (3q/3q/3q/q) and the answers so far (lead: run_jobs has no member read path). While a run is queued or running, the page refreshes every 5 s.
- Exports: export.csv (toCsv) and export.png (next/og, 1200×630) under both routes, with Content-Disposition attachment, Cache-Control no-store, noindex and a [a-z0-9.-] filename. An unknown run or token is a 404.
- Token privacy (lead): /audit/* sends Referrer-Policy: no-referrer and X-Robots-Tag: noindex, nofollow (next.config headers), the page has robots noindex,nofollow, cited links use rel="noopener noreferrer", and the lead email is never rendered.
- /dev/audit?state=… shows every state with Example data (404 in production).
- Real 404s: these pages stream inside Suspense, and notFound() there still sends a 200. So the proxy (src/lib/supabase/middleware.ts, the same pattern as /admin) rewrites to a 404 first. A run not readable by the visitor's session (RLS) or an unknown audit token (service role) gets the 404. The exports are route handlers and 404 on their own. The route is matched on the normalized path, but the token or run id comes from the raw path, because normalizePath lowercases and tokens are mixed-case base64url (review on #35).
- Doc difference: citations.category is typed string in the result query and Category in computeMetrics. The loader casts it, because Step 6 stores only categorize() values.

## Step 8 (data-pipeline): competitor suggestions and visibility series (branch feat/step8-suggestions)
Step 8 built from ENG_HANDOFF_OVERNIGHT §6 + docs/*; Build Pack not readable; reconcile later.
Lead decisions (Step 8 brief): suggested competitors = findLocalCompetitors for the business cuisine/city (existing cache + maps_lookup token) minus tracked and dismissed; keys missing → nothing shown. The 8-run line = the latest 8 complete/partial audit+weekly runs; fewer than 2 → hidden. Free audits never appear in /app.
- One paid lookup serves both (lead, 2026-11-05): the 24 h cache holds the full Maps list (≤20, Maps order), keyed cuisine|city|state|domain with no limit in the key. src/lib/onboarding/lookup.ts lookupCompetitors does that. Onboarding's findCompetitorsAction shows the first 5, as before. findLocalCompetitors takes an optional `limit` (default 5, unchanged). withLimits moved from src/app/app/onboarding/limits.ts to src/lib/onboarding/limits.ts, and the old path re-exports it.
- Test changed, with reason: tests/unit/onboarding/actions.test.ts now expects findLocalCompetitors to be called with `{ ...q, limit: 20 }` (was `q`), because onboarding's lookup fills the shared cache. A new test checks onboarding still returns only the top 5 while the cache keeps all of them.

Changed
- src/lib/onboarding/suggest.ts suggestCompetitors({business, tracked, dismissed}, {store}): drops Maps items whose bare domain or normalized name (detectMentions' normalize) matches a tracked or dismissed competitor or the business; first of each domain/name kept; Maps order; ≤5. limited / missing_keys / error → no items. Never throws.
- src/lib/metrics/series.ts seriesFromSummaries(summaries): {points: {runId, at, metric: Metric}[] oldest → newest, visible: ≥2}.
- src/lib/metrics/series.ts seriesFromSummaries(summaries): takes listRunSummaries rows (RunSummary, #38) and passes their visibility Metric through. Returns {points: {runId, at, metric}[] oldest → newest, visible: ≥2}, keeping only complete/partial audit+weekly runs as a safety net. Callers use listRunSummaries(db, id, 8, ["complete", "partial"]), which filters before the limit.

## Step 9 (data-pipeline): per-engine sources and location view (branch feat/step9-sources, issue #42)
Step 9 built from ENG_HANDOFF_OVERNIGHT §6 + PRODUCT.md + docs/UI.md; Build Pack not readable; reconcile later.
Lead decisions (Step 9 brief): /app/sources reads the latest complete/partial audit/weekly run. One card per engine with cited links by category (counts, never %), categories from citations.category only. Top domains ≤20. A location selector ("All locations" + each question target) filters the chart and the table. An engine's badge is "Country fallback" if any answer fell back. No SoV and no percentages on the page.

Changed
- src/lib/metrics/sources.ts computeSources({questions, location?}) over getQuestionsWithLatestAnswers' questions:
  - links = citations of ok answers as stored (deduped per answer); deleted questions are already excluded by the query; a null/unknown category → other;
  - engines in ENGINE_IDS order with all 6 categories in a fixed order (0s kept);
  - locationSupport from that engine's non-failed answers: any fallback_country → fallback, all exact → exact, none → null;
  - topDomains by bare domain (most-cited category, ties by the fixed order; engines in order), sorted by links desc then domain, ≤20;
  - locations from questions with answers: key `level:country|state|city` (fields above the level dropped).
- Labels match the Questions page badge (#40): "City", "State", "Country". Only when two targets share a level is the place added ("City · Irvine, CA"). An unknown location key → an empty result, never everything.
- citations.category on getQuestionsWithLatestAnswers came from backend #43 (a57fbdf), merged into this branch.

## Step 8 (frontend): self-serve shell and pages (branch feat/step8-shell, issue #37)
- /app layout: AppNav (aria-label "App"), a left rail at md+ and a sideways-scrolling row on phones, with only the pages that exist (Dashboard, Competitors, Questions, History, Billing). Hidden on /app/onboarding.
- Dashboard (lead):
  - no business → the 4b empty + 'Add my business' → /app/onboarding;
  - a business with no complete/partial run → paid "No weekly checks yet. Your first one runs Monday." or unpaid 'Start for $99/mo' → /app/billing (CurrentBusiness.paid, #38);
  - otherwise hero + change + the partial warn badge, the 8-run line (hidden under 2 runs), per engine, leaderboard top 5 (visibility only, no SoV), and "What to fix next" (top 3 fixes, or the Fix list empty copy with no link).
- Competitors: SoV only here, the leaderboard (You row first on phones), Suggested competitors (suggestCompetitors through the shared lookup store: 24 h cache + maps_lookup token) with Add / Not a competitor, and manual add. The business always comes from the session in the server actions.
- Questions: read-only, with per-engine dots for the latest run, the failed '–' tooltip (lead copy), the location badge, and a modal drawer (focus trap, Esc, focus returns, noreferrer links). History: every audit/weekly run newest first, linking to /app/runs/[id] with Download CSV.
- AuditView's Hero / EngineTable / Leaderboard are shared (exported). The onboarding lookup store moved to src/app/app/lookup-store.ts, so onboarding and Competitors share it.
- The visibility line follows UI.md Chart (one jellyDeep 2px line) and the dataviz skill: no legend for one series, a hover tooltip with n, and an sr-only table.

## Step 8 QA fix (frontend): rule 3 on Competitors and History (branch fix/step8-rule3, issue #37, QA #46)
- PRODUCT.md rule 3: Competitors phone cards now show "{pct} (named in a of n answers)" like the desktop table. Competitors has the Freshness line ("Checked … ago · n answers · API-measured, directional") at both widths. History carries "API-measured, directional" once (its rows have their own dates).
- A shared Measured component (src/components/app/Page.tsx) renders the Freshness line when there is one check time, and the label alone otherwise. Step 9's Sources page reuses it.

## Step 10 (backend): fix results and status (branch feat/step10-fix-results, issue #48)
- Step 10 built from ENG_HANDOFF_OVERNIGHT §4/§6 + SCHEMA.md §5b; Build Pack not readable; A1–A6 seeded disabled; reconcile later.
- Lead decisions:
  - Detectors exist only for the enabled rules R10, R11, R14, H1 (own fetch, no paid calls).
  - A1–A6 are disabled placeholders ('PENDING: Build Pack Step 10', never rendered).
  - Detection runs once per paid run that closes complete/partial, never for free audits. The data-pipeline always records all 4 enabled rules (unchecked on any internal error), so a run is never retried forever.
  - fix → upsert the open fix. ok → auto-resolve. unchecked → leave the fix ("We couldn't check this yet.").
  - Ranking by size S → L, then rule key. H1 appears only under Tidy-ups, never in the Dashboard top 3. affected_answers is null for site rules.
  - Status is writable by self-serve members + team. A dfy_client never writes.
  - listFixes returns open fixes only. Marking a fix done hides it, and if the next run still detects it, a fresh todo comes back.
- Migration 20261105000014 (+ .down.sql), additive and re-runnable:
  - A1–A6 rows (grp answers, enabled false, ai_lever true, unverified = ['PENDING: Build Pack Step 10']).
  - fixes.affected_answers is nullable with no default.
  - Unique open fix per (business, rule).
  - fix_checks(run, business, rule, result): RLS read = can_see_fix_list. It's the once-per-run marker, so there's no runs.fixes_checked_at.
  - record_fix_results: service only, one transaction, a no-op for an already-recorded run, 22023 for a bad run or rule.
  - runs_needing_fix_checks: service only. set_fix_status: invoker, can_write_fixes, 42501/22023.
- Queries: listFixes / setFixStatus / recordFixResults / listRunsNeedingFixChecks (src/lib/queries/fixes.ts). getTopFixes now uses the same ranking and skips tidy-ups, and TopFix.affected_answers is number | null.
- Test changes from lead decisions:
  - tests/db/seed.test.ts expects 22 fix_rules with A1–A6 disabled (was "no A rules", 16).
  - The shell getTopFixes test uses one fix per rule and size ranking (was affected_answers order).
  - onboarding.test's team-added fix uses R2 (one open fix per rule).
- src/types/db.ts got the 0014 objects added by hand in the generator format. Regenerate it with `pnpm db:types` when a stack is available.

## Step 9 (frontend): sources page with location view (branch feat/step9-sources-page, issue #42)
Step 9 built from ENG_HANDOFF_OVERNIGHT §6 + PRODUCT.md + docs/UI.md; Build Pack not readable; reconcile later.
- /app/sources (nav after Questions): the latest complete/partial run's cited links through computeSources (#44).
  - A "Location" select ("All locations" + each target, locationLabel) in ?location=, filtered on the server.
  - One card per engine with "{n} links", a stacked bar by category (counts only, no %), the "Exact" / "Country fallback" badge (greyed tooltip) and "No links cited by {Engine}".
  - The top domains table (noopener noreferrer); empty / loading / error states.
- Rule 3 (review on #45): the Freshness line ("Checked … ago · n answers · API-measured, directional") under the subtitle, through the shared Measured from #47. n = ok answers of the questions in the selected location.
- The Questions location badge now uses locationLabel, so it and the selector can't disagree.
- Category colors (lead Q3: O1; dataviz validator, paper surface, all pairs):
  - Solid: Reddit jellyDeep, YouTube amber, Review sites jelly, News and blogs warnText. These four pass every pair.
  - Striped (45° SVG texture; CSS gradients are aurora-only): Social jellyDeep, Other inkMuted (neutral). Texture tells them from the solid fills, and the two striped fills pass separation from each other (ΔE 16.8).
  - Every segment's count is also shown as text under its bar.

## Step 10 (data-pipeline): site checks R10, R11, R14 and H1 (branch feat/step10-site-checks)
Step 10 built from ENG_HANDOFF_OVERNIGHT §4/§6 + SCHEMA.md §5b; Build Pack not readable; A1–A6 seeded disabled; reconcile later.
Lead decisions (Step 10 brief): detectors only for the enabled rules R10, R11, R14 and H1, using our own fetch, with no paid calls and no LLM. Detection runs once per paid run after it closes complete/partial, from the cron drain, never for free audits. No domain → every site rule is unchecked. fix = upsert, ok = auto-resolve, unchecked = leave as is. R14 fixes only for OAI-SearchBot and PerplexityBot; GPTBot and Google-Extended are info only.
- Time budget (lead): at most 1 run per cron tick, a 45 s crawl budget, started only with ≥60 s left of the cron route's maxDuration (300 s).
- R10 no-menu case: reconcile with Build Pack. No menu page, or an ambiguous HTML menu (<5 prices and <3 images) → unchecked, reason menu_not_found / menu_ambiguous. No new copy.

Changed
- src/lib/onboarding/read-site.ts: createSiteFetcher(domain, {maxRequests, budgetMs}), readSite's guarded fetcher (SSRF/DNS guard, same-site redirects, 1 MB, 10 s, Rank1 UA, robots obeyed), plus page caching, a request/time budget, the final page URL, and robots status ok | missing | error. robotsAllows(text, path, agent = "rank1"). readSite now uses the fetcher, with the same behavior.
- src/lib/fixes:
  - R10 (menu link by text/href, else /menu; PDF/image by href or content-type; ≥5 prices = a text menu);
  - R11 (dish names = text before the first price; ≤20 same-site pages; covered = in H1–H3 or FAQ text incl. FAQPage/Question/Answer JSON-LD; first 5 uncovered in the copy);
  - R14 (each bot's group else *, "/" and "/menu");
  - H1 (Restaurant / FoodEstablishment family / Menu JSON-LD or hasMenu on home + menu);
  - evaluateFixes (R10, R11, R14, H1 order; unchecked reasons no_domain, robots_disallowed, site_unreachable, robots_unreachable, menu_not_found, menu_ambiguous, no_html_menu, error);
  - checkFixesForOneRun (cron.ts): always records every enabled rule per run (an evaluate error → unchecked rows, reason error), so with backend's fix_checks marker no run is retried every tick.
- Re-crawl guards (lead, 2026-11-05): (1) the enabled rules are read from fix_rules at run time (service role), and only those are evaluated and recorded; the R11 crawl is skipped when R11 is off. (2) If record_fix_results fails (e.g. 22023 after a rule was disabled), it retries once in the same tick with every enabled rule unchecked 'error' and no new crawl, so the run gets marked.
- The copy templates are the SCHEMA §5b customer copy verbatim (a test reads docs/SCHEMA.md); detail is set only for fix.
- Wiring (after #50): src/lib/fixes/service.ts reads fix_rules.enabled (service role) and uses listRunsNeedingFixChecks(db, 1) and recordFixResults. GET /api/cron/run-jobs runs it after the drain and notify, with time left = maxDuration (300 s) − elapsed since the request started, and returns `fixes`.
- PROGRESS.md: the duplicate "## Step 9 (data-pipeline)" section on main (a merge leftover) is merged into one copy, with no line dropped.

## Step 11 (data-pipeline): context brief from stored data (branch feat/step11-context)
Step 11 built from ENG_HANDOFF_OVERNIGHT §3/§6 + issue #10; Build Pack not readable; reconcile later.
Lead decisions (Step 11 brief): no in-app AI. Copy context = a Markdown brief of stored numbers and texts for the selected item, each with n + freshness and "API-measured, directional": business, latest visibility (overall + per engine), leaderboard, top sources, open fixes (title + detail), and questions where the business wasn't named. Never why_note, raw, cost, vendor stats, lead emails or tokens. Open in Claude opens exactly https://claude.ai after copying the brief; no ?q= and no data in the URL.

Changed
- src/lib/workspace/context.ts:
  - buildContextMarkdown(input, selection, now, prompt): input = getCurrentBusiness/listDfyBusinesses + computeMetrics + computeSources + listFixes + getQuestionsWithLatestAnswers + listRunSummaries.
  - It keeps #11's format (# title, "- label: text", namedText/visibilityText/pointsChange/fallbackNote, ## Sources, ## Prompt template). It reads named fields only. Every % carries "named in a of b answers"; null → "no answers yet".
  - Lists cap at 10 (questions 25) with "…and N more"; the brief caps at 12,000 chars by dropping the lowest sections, and the header and visibility are always kept.
- claudeUrl and CLAUDE_Q_MAX are removed and CLAUDE_URL = "https://claude.ai" replaces them. ContextPane's href uses it (its onClick still copies the brief first). The team e2e now asserts the exact URL.
- Tests changed, with reason: tests/unit/workspace/brief.test.ts's two claudeUrl ?q= prefill tests are replaced by one asserting CLAUDE_URL === "https://claude.ai" (lead, Step 11: the prefill is removed). tests/e2e/team-workspace.spec.ts asserts the href is exactly CLAUDE_URL and the popup is https://claude.ai/ (routed, never reaches the real site).
- Removed two unused imports in tests/unit/fixes/rules.test.ts (lint warnings from Step 10).

## Step 11 (backend): team read access to DFY clients (branch feat/step11-team-read, issue #54)
- Step 11 built from ENG_HANDOFF_OVERNIGHT §3/§6 + issue #10; Build Pack not readable; reconcile later.
- Lead decisions:
  - /team keeps #11's 3-pane workspace on real data, behind ENABLE_TEAM_WORKSPACE (Production false). Access is role 'team' only.
  - The team sees every DFY business across workspaces, never self-serve data, and reads through RLS (no service role in a page path).
  - Nav: Dashboard, Questions, Competitors, Sources, Fix list, History.
  - The Copy context brief uses stored values only. Open in Claude = exactly https://claude.ai. No LLM.
  - O1 (lead): any team user writes fixes (status) and competitors of any DFY business. can_write_fixes / can_write_competitors = (self_serve and member) or (team and dfy). A dfy_client still never writes.
- Migration 20261105000015 (+ .down.sql), additive and re-runnable:
  - Helpers private.is_team_dfy_business / team_can_read_run / team_can_read_answer.
  - Extra SELECT policies (*_team_read) on businesses, competitors, questions, runs (no free_audit), answers, citations, fixes and fix_checks, DFY only. Member and dfy_client policies are unchanged.
  - Widened write helpers (O1). The rollback restores the membership-only helpers.
- Query: listDfyBusinesses (src/lib/queries/team.ts). Every team-page query (getRunResults, getPreviousRun, listRunSummaries, getQuestionsWithLatestAnswers, listCompetitors, listFixes) is tested as a non-member team user. Tests: tests/db/team.test.ts.

## Step 10 (frontend): What to fix next page (branch feat/step10-fixes-page, issue #48)

- Built from ENG_HANDOFF_OVERNIGHT §4/§6 and SCHEMA.md §5b. The Build Pack wasn't readable, so reconcile later. A1–A6 stay seeded disabled.
- /app/fixes: listFixes → ranked (S→L, ranked server-side), Tidy-ups (hygiene, h2 + h3 cards), and "We couldn’t check this yet." rows from backend's unchecked {rule_key, title}. "Listing and site checks need your website URL" shows when the business has no domain.
- Status select (To do / Doing / Done) via setFixStatusAction → set_fix_status. Every self-serve member may write, and RLS checks again. On error the value reverts and a Banner shows "We couldn't save that. Try again." (that copy is awaiting the lead's OK). Done removes the fix (only open fixes are listed).
- The shared FixList (src/components/fixes) is reused by Steps 11/12. There, canWrite={false} renders a read-only status badge.
- Rule 3: a Measured line (latest run, ok answers) under the H1.
- Nav: "What to fix next" after Sources. The Dashboard section heading links to /app/fixes (top 3 from getTopFixes, same ranking).
- n fix (#57): the Freshness n comes from loadShell().latest.metrics, the same object the Dashboard hero renders. tests/unit/app/measured.test.tsx (the fixes n equals the Dashboard n with a no_overview answer) supersedes measured.test.ts, which only checked runMeasured against jobs_ok and went away with runMeasured.
- QA #58 gallery fidelity (#57): the /dev/app fixes fixtures use the fix_rules titles and §5b copy filled for a made-up site, in bySize order (R14, R10, R11), with no answer count for site rules. The fixes states take n from the Dashboard gallery metrics (240). tests/unit/fixes/example-data.test.ts checks titles against seed.sql, details against COPY, and the order.

## Step 11 (frontend): team workspace on real data (branch feat/step11-team-real, issue #54)

- Step 11 built from ENG_HANDOFF_OVERNIGHT §3/§6 + issue #10. The Build Pack isn't readable, so reconcile later.
- Lead decisions (brief): same 3-pane shell on real data behind ENABLE_TEAM_WORKSPACE (Production false); team sees every DFY business only, read through RLS (#56), never the service role; nav shows only pages with real data (Dashboard, Questions, Competitors, Sources, Fix list, History; Experiments/Reports/Settings hidden until Steps 15–17); Copy context = buildContextMarkdown (#55); Open in Claude = exactly https://claude.ai after the copy; team writes fix status and competitors through the existing RPCs.
- /team?b=<id>: src/app/team/load.ts reads listDfyBusinesses → getWorkspaceRows (#11's panes), listRunSummaries (complete/partial audit and weekly runs, as /app; getWorkspaceRows now reads the same kinds, review on #60) + loadPaidRun → computeMetrics, getQuestionsWithLatestAnswers → computeSources, listFixes. Maps suggestions load only when the Competitors view opens (teamSuggestions server action, review on #60), so a /team load or a client switch spends no maps_lookup token. No b → the first client by name. An unknown, archived or self-serve b is a real 404 in the proxy (teamClient), with notFound() as the fallback.
- Client switcher: a GET form (label "Client", "Show") at the top of the context pane, not the sidebar head (design note), so it stays usable when the sidebar is an icon rail between md and lg.
- Fix list: the shared FixList (new level prop: h3 cards inside a workspace document). Competitors: the /app suggestions and add form, extracted into CompetitorActions.tsx and used by both. Team server actions re-check the client against listDfyBusinesses.
- Lead copy: "No clients yet." (no add-client UI in /team), "Client"; the Open in Claude toast is now "Brief copied. Paste it in Claude."
- #11's Example workspace moved to the /dev/team gallery (404 in production, no sign-in); team-workspace.spec runs there. tests/e2e/team-real.spec.ts covers the real /team (seeded DFY + self-serve businesses).
- No LLM SDK: tests/unit/engines/no-llm-sdk.test.ts already guards the repo.

## Step 12 (backend): client invites and fix list visibility (branch feat/step12-client-invites, issue #59)
- Step 12 built from ENG_HANDOFF_OVERNIGHT §3/§6 + Step 3 routing; Build Pack not readable; reconcile later.
- Lead decisions:
  - No invites table. A team user invites by email for a DFY business (Supabase Auth admin invite, redirectTo NEXT_PUBLIC_SITE_URL/auth/callback), then the service role grants dfy_client + workspace membership.
  - Any existing Rank1 account is refused ("This email already has a Rank1 account."), and this business's client gets "Already invited.".
  - One business per client user (lead, 2026-11-05); reconcile with Build Pack. An existing client of another DFY business counts as an existing account.
  - Remove access drops the membership and keeps the role. The fix list toggle is team-only.
  - /client is read-only. Emails never go in logs or error messages, only status codes.
- Migration 20261105000016 (+ .down.sql), additive and re-runnable:
  - Service only: client_invite_status, grant_dfy_client (idempotent; refuses team users, members of other workspaces and non-DFY businesses) and revoke_dfy_client (never an owner).
  - Team only: set_fix_list_visible and list_client_users (emails for team only).
- Queries (server only, src/lib/queries/clients.ts): inviteClient (injectable invite fn; CI has no mail server), removeClient, listClientUsers, setFixListVisible. Tests: tests/db/clients.test.ts.
- src/types/db.ts got the 0016 functions added by hand in the generator format. Regenerate it with `pnpm db:types` when a stack is available.

## Step 11 QA fix (frontend): Vercel preview toolbar in the no-model-calls check (branch fix/step11-preview-toolbar, issue #54, QA #62)

- tests/e2e/team-workspace.spec.ts "nothing calls a model": on deployed previews (E2E_BASE_URL set) the exact host vercel.live is ignored, because Vercel injects its preview toolbar (vercel.live/_next-live/feedback/feedback.js) into every preview page. Every other host still fails the test, and it now also asserts that no request goes to api.anthropic.com, api.openai.com, generativelanguage.googleapis.com or api.perplexity.ai.

## Step 12 (frontend): DFY client dashboard and invites (branch feat/step12-client, issue #59)

- Step 12 built from ENG_HANDOFF_OVERNIGHT §3/§6 + Step 3 routing. The Build Pack isn't readable, so reconcile later.
- Lead decisions (brief + 2026-11-05 answers):
  - no invites table: the team invites through inviteClient (#61) after a team (my_landing) + DFY check;
  - existing accounts are refused;
  - /auth/callback accepts type invite;
  - Remove access keeps the role;
  - a team-only fix-list toggle;
  - /client is read-only and light only;
  - one DFY business per client user, so no "Business" switcher on /client.
- /auth/callback: 'invite' added to EMAIL_TYPES. tests/unit/auth/callback.test.ts used to list invite among the rejected types; that case is now recovery (still rejected), per the lead's decision.
- /team Clients tab: a "Clients" button under the Client switcher opens a Clients document tab (lead Q1; no seventh nav item). It holds:
  - ClientsPanel: the client users (listClientUsers), Remove access, "Show fix list to client" and the Invite client form;
  - server actions inviteTeamClient, removeTeamClient and setTeamFixListVisible, which re-check team + DFY. Invite and remove use the service role, server only. Status codes only: emails are never logged.
- Statuses:
  - invited → "Invite sent to {email}."; existing_account and already_invited map to their lead strings;
  - invalid_email → the forms' email error;
  - error → "That didn't send. Try again in a minute.";
  - a failed Remove access or toggle → "We couldn't save that. Try again."
- /client: src/app/client/load.ts reads listDfyBusinesses through RLS (the client's own; none once removed), listRunSummaries(20) and loadPaidRun of the newest complete/partial run, and listFixes only when fix_list_visible. ClientDashboard shows:
  - H1 "Dashboard" and the business name;
  - the Hero (n + change + freshness), the 8-run line, per engine, and leaderboard top 5;
  - the History table without /app run links or CSV (HistoryTable extracted from HistoryView, linked=false);
  - FixList canWrite=false.
- Empty states: no business → "Nothing tracked yet." (no button); no run → "No weekly checks yet. Your first one runs Monday.". Plus loading and error.
- Gallery: /dev/client (success, fixes, partial, no-run, removed, loading, error); the /dev/team gallery gains the Clients tab.
- DB e2e: tests/e2e/client-invite.spec.ts. An admin invite link + grant_dfy_client (what inviteClient does, without mail) → /client; no fixes until the toggle; existing account and Already invited; Remove access → "Nothing tracked yet."

## Step 13 (backend): weekly run enqueue and cache pruning (branch feat/step13-weekly-enqueue, issue #67)
- Step 13 built from ENG_HANDOFF_OVERNIGHT §6; Build Pack not readable; reconcile later.
- Lead decisions:
  - /api/cron/weekly at "0 13,14 * * 1" UTC, which proceeds only on Monday 06:xx America/Los_Angeles (DST-safe), with a constant-time CRON_SECRET check.
  - Eligible = active business + (active/trialing subscription or service 'dfy'). Skip it if it already has a weekly run this ISO week (LA) or an open run.
  - Enqueue only: the run-jobs cron drains. Counts-only logs.
  - Prune lookup_cache > 24 h and rate_events > 48 h on the same fire. No UI change and no new env.
  - No unique index (lead): the business row lock plus create_run's one-open-run rule keep it idempotent.
- Migration 20261105000017 (+ .down.sql), service only:
  - enqueue_weekly_runs(week_start) → {enqueued, skipped, failed}. week_start must be the current LA week's Monday. Each business runs in its own subtransaction, so one failure never aborts the rest, and no active questions = skipped.
  - prune_ephemeral() → {lookup_cache, rate_events}.
- Queries: laWeekStart, enqueueWeeklyRuns, pruneEphemeral (src/lib/queries/weekly.ts).
- Cleanup: removed the duplicate "QA #58 gallery fidelity" line under Step 12 (backend). The original under Step 10 (frontend) stays.
- src/types/db.ts got the 0017 functions added by hand in the generator format.

## Step 13 (data-pipeline): weekly cron route (branch feat/step13-weekly-cron)
Step 13 built from ENG_HANDOFF_OVERNIGHT §6; Build Pack not readable; reconcile later.
Lead decisions (Step 13 brief):
- Vercel Cron is UTC, so /api/cron/weekly is scheduled "0 13,14 * * 1" and proceeds only when it's Monday 06:xx in America/Los_Angeles; the other fire is a no-op.
- The same CRON_SECRET bearer check as run-jobs, in constant time.
- Eligible = active businesses whose subscription is active/trialing, or DFY; skip one with a weekly run this LA ISO week or an open run. Idempotent.
- The route only enqueues; the run-jobs cron drains.
- Logs carry counts only. lookup_cache > 24 h and rate_events > 48 h are pruned on the same fire. No UI change, no new env.

Changed
- src/lib/runs/weekly.ts:
  - isWeeklyWindow(now): LA weekday + hour via Intl, so no DST math of ours.
  - The week key is backend's laWeekStart (src/lib/queries/weekly.ts), the same function enqueue_weekly_runs validates against, so there's one implementation; my DST tests cover it.
  - runWeekly(deps): enqueue, then prune; prune runs even when enqueue failed (lead). One counts/PG-code log line. 500 bodies are {error: "enqueue_failed" | "prune_failed"} with no DB text.
- src/lib/runs/drain.ts cronAuthorized: constant time, crypto.timingSafeEqual over SHA-256 digests (equal length). Shared by both cron routes (fixes the Step 6 QA note).
- /api/cron/run-jobs 500: {error: "claim_failed"} with only the PG code logged (was `claim_jobs: <DB message>`). Test changed with reason: cron-route.test.ts expects the new body and checks that the log has no DB text; same strictness, new expected body (lead).
- vercel.json crons adds {path: "/api/cron/weekly", schedule: "0 13,14 * * 1"}; vercel-config.test.ts pins both crons.
- src/app/api/cron/weekly/route.ts (maxDuration 60): 401 unless authorized; outside the window → 200 {skipped: "outside_window"} without creating a DB client; inside → enqueueWeeklyRuns + pruneEphemeral (service client, backend #0017) via runWeekly.

## Step 14 (backend): stripe subscription state (branch feat/step14-stripe-state, issue #71)
- Step 14 built from ENG_HANDOFF_OVERNIGHT §6 + UI.md 4b; Build Pack not readable; reconcile later.
- Lead decisions:
  - Hosted Checkout (no publishable key) with quantity = active self-serve businesses (min 1). DFY never counts or sees billing.
  - The webhook is the source of truth: signature check, then the stripe_events idempotency, then a service-only update.
  - Add = quantity +1 with Stripe's default proration. Remove = quantity −1 at period end through a Subscription Schedule (phase 1: current quantity until current_period_end, phase 2: quantity − 1; data-pipeline implements it), and the business is archived at the period end.
  - Manage billing = Customer Portal. The switcher picks the current business (default oldest). Weekly checks pause unless active/trialing.
  - While a removal is scheduled, the business still counts as active until archive_at. At renewal the archive happens first, then seats.
- Migration 20261105000018 (+ .down.sql), additive:
  - workspaces.stripe_current_period_end / stripe_event_at and businesses.archive_at. All are service-write only, like the billing fields.
  - apply_stripe_subscription(p): one transaction. It finds the workspace by customer id or client_reference_id first (not_found is NOT recorded, so Stripe's retry can apply it once checkout links the customer), then records the event (duplicate → no-op), ignores stale events, archives due removals and only then sets ids/status/seats/period end.
  - apply_stripe_subscription(p): one transaction. It records the event (duplicate → no-op), then finds the workspace by customer id or client_reference_id, ignores stale events, archives due removals and only then sets ids/status/seats/period end.
  - record_stripe_event. schedule_business_removal / cancel_business_removal / archive_scheduled_businesses. All service only, self-serve only (DFY untouched).
- Queries (src/lib/queries/billing.ts):
  - getBillingState, listMyBusinesses (member client).
  - applyStripeSubscription, recordStripeEvent, scheduleBusinessRemoval, cancelBusinessRemoval, archiveScheduledBusinesses (service client).
  - getCurrentBusiness(db, selectedId?) honors a selected id that's one of the caller's active self-serve businesses, else the oldest.
- Cleanup: merged the doubled "## Step 12 (backend)" section (the second copy was fully contained in the first; no line lost).
- src/types/db.ts got the 0018 columns and functions added by hand in the generator format.

## Step 16 (backend): monthly reports, storage and report settings (branch feat/step16-reports-db, issue #75)
- Step 16 built from ENG_HANDOFF_OVERNIGHT §6 + UI.md 4b; Build Pack not readable; reconcile later.
- Step 15 (GA4) is skipped until the founder's Google OAuth client exists. The report's GA4 section is "not connected" (hidden + 'Connect GA4').
- Lead decisions:
  - Who: active/trialing workspaces or DFY businesses, one report per business per LA calendar month, for the previous month. Idempotent.
  - When: /api/cron/monthly-report at "0 14,15 1 * *" UTC, gated to the 1st at 07:xx LA. The drain renders and sends at most 2 per tick.
  - Content is stored data only. Brand color is used for accents with an AA fallback to ink. White-label: no Rank1 name, logo, Jelly or "Powered by" in the PDF or email. From = business name <REPORT_FROM_EMAIL>.
  - Recipients ≤ 10 validated emails. Send test → own email only. No recipients → generated, not sent.
  - Storage: private "reports" and "logos" buckets (logos PNG/JPEG ≤ 512 KB; SVG rejected).
- Migration 20261105000019 (+ .down.sql), additive and re-runnable:
  - Buckets created when storage.buckets exists. No storage.objects policies: the server checks access with the caller's client, then uploads or signs 60 s URLs with the service client.
  - Businesses write gate (maintainer OK, lead 2026-11-05; reviewer fix): SELECT for members (+ team on DFY, 0015). RLS INSERT/UPDATE/DELETE for self-serve members only (never a dfy_client). The team changes a DFY business only through definer RPCs (set_report_settings, set_fix_list_visible), so it can never move (workspace_id) or delete one. id/workspace_id/service are service-role only (column grants). Before this, the Step 1 FOR ALL member policy let a dfy_client UPDATE its business.
  - Report settings CHECKs (NOT VALID, for legacy rows): brand_color hex, report_recipients ≤ 10 lowercase emails, logo_path under the business id. logo_path is no longer member-writable.
  - reports: attempts/locked_at/last_error, the status check, unique (business, period_start). The member policy is now SELECT only (+ team read on DFY).
  - enqueue_monthly_reports / claim_reports / finish_report (service only). set_report_settings(business, color, recipients): a definer RPC for self-serve members or the team on DFY (trims, lowercases, dedupes; CHECKs reject bad input). public.can_write_business for server-side checks (logo upload).
- CI: test-db now starts Supabase WITH storage-api (removed from its -x list) so the buckets and signed URLs are tested for real.
- Queries: src/lib/queries/reports.ts.
- src/types/db.ts got the 0019 objects added by hand in the generator format.

## Step 14 (data-pipeline): checkout, webhook and portal (branch feat/step14-billing)
Step 14 built from ENG_HANDOFF_OVERNIGHT §6 + UI.md 4b; Build Pack not readable; reconcile later.
Lead decisions (Step 14 brief):
- Stripe test mode only, one $99 Price, quantity = active self-serve businesses (minimum 1); DFY never counts.
- Hosted Checkout (no publishable key).
- The webhook is the source of truth (signature over the raw body, idempotent via stripe_events, never trust success_url).
- Add = quantity +1 with Stripe's default proration (INTEGRATIONS.md "confirm": kept default). Remove = quantity −1 at period end, then the business is archived.
- Manage billing = Customer Portal.

Changed
- `stripe` (official SDK, 23.1.0) added; it is not an LLM SDK.
- src/lib/stripe/client.ts: stripeClient with apiVersion pinned to the SDK's ("2026-10-28.endive"); assertTestMode refuses sk_live_/rk_live_ and a missing key before any call.
- src/lib/stripe/billing.ts:
  - createCheckoutSession (subscription mode, the price × quantity ≥ 1, client_reference_id = workspace, a stored customer reused);
  - updateQuantity (+1, default proration; raises an attached removal schedule's phases too);
  - scheduleRemoval;
  - createPortalSession.
- Removal mechanism: a Subscription Schedule (from_subscription, or the attached one). Phases [current, quantity N, until the item's current_period_end; next, quantity N−1, one month], end_behavior release. A second removal lowers the next phase again; it never goes below 1. In this API version current_period_end is on the subscription item, so that's where it's read.
- src/lib/stripe/webhook.ts handleStripeWebhook (bad/missing/stale signature → 400):
  - customer.subscription.* → apply_stripe_subscription {event_id, event_type, event_created, customer_id, subscription_id, status, quantity, current_period_end};
  - checkout.session.completed → retrieves the subscription, then the same call with client_reference_id;
  - invoice.paid / payment_failed → record_stripe_event only;
  - unknown → 200 ignored.
  - applied/duplicate/stale → 200 (logged). not_found → 500 "not_linked" (lead, after review): a subscription event can arrive before checkout.session.completed links the customer, 0018 leaves not_found unrecorded, and Stripe retries with its own backoff. An RPC error → 500 "apply_failed".
  - checkout.session.completed retrieves the subscription (items come back by default) and applies the full state (status, quantity, period end) plus client_reference_id, so seats/status are right even with no later subscription event.
  - Review (#73): every customer.subscription.* event also retrieves the subscription and applies Stripe's current state, not the event snapshot, because same-second created/updated events can leave a paid workspace "incomplete". event.created still drives the stale check. A failed retrieve → 500 (Stripe retries).
  - Test changed, with reason: the not_found case moved from 200 to 500 not_linked (lead decision); an ordering test covers subscription-first then checkout.
  - Logs: event type, id and outcome only.
- .env.example: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY marked UNUSED (hosted Checkout).
- Wiring (after #72):
  - POST /api/stripe/webhook reads req.text() and verifies with stripe.webhooks.constructEvent + STRIPE_WEBHOOK_SECRET. It calls applyStripeSubscription / recordStripeEvent (service client). Unix times are converted to ISO for the RPC.
  - A live key or a missing secret → 500 {error: "not_configured"}.
- src/lib/stripe/service.ts (server-only): startCheckout(callerDb, quantity, urls), addBusinessSeat(callerDb), removeBusinessAtPeriodEnd(callerDb, businessId), openPortal(callerDb, returnUrl). Review (#73): each takes the caller's own client and derives the workspace from getBillingState(callerDb). Removal first checks the business is in listMyBusinesses(callerDb) (RLS), before any Stripe call or schedule_business_removal, so no cross-tenant archive. Stripe ids are read with the service client and never sent to the browser.
- Stripe's `paused` subscription status is in 0018's SubscriptionStatus (backend added it), so a paused subscription applies instead of failing with 22023.

## Step 14 (frontend): billing page and business switcher (branch feat/step14-billing-ui)

- Step 14 built from ENG_HANDOFF_OVERNIGHT §6 + UI.md 4b. The Build Pack isn't readable, so reconcile later.
- Lead decisions: hosted Checkout and Customer Portal (server actions redirect; no publishable key); quantity = active self-serve businesses; the webhook is the source of truth; amounts in the UI are only the UI.md x $99 math.
- BillingView: no plan (null/canceled/incomplete) → the Pricing card + 'Start for $99/mo' (Checkout); past_due → the failed banner + 'Update card' (portal) + the "Past due" badge; unpaid → the failed banner + 'Update card'; active/trialing → "Plan", "{n} businesses x $99 = ${n×99}/mo", "Next invoice {date}", 'Manage billing' (portal, spinner while opening). Plus loading and error.
- BusinessSwitcher (header): the name only with 1 business. Otherwise:
  - a popover (bottom sheet on phones, 56px rows): name, city, '34% · 250 answers', and a moss/brick status dot with "Active"/"Paused" for screen readers;
  - max height 360, search over 8;
  - '+ Add a business ($99/mo)' and the agency caption;
  - "More for {name}" → 'Remove business'.
  The Add and Remove dialogs use the exact UI.md text (Dialog: focus in, Tab trapped, Esc, focus returns).
- Add: actions.add (quantity +1 with default proration, or Checkout when unpaid). Then it polls seats every 2 s until seats_quantity rises → /app/onboarding. After 30 s it keeps "Adding your business…" with "Try again" and no error (lead).
- Lead copy in COPY.md "Billing (lead, 2026-11-05)".
- Wiring:
  - /app/billing reads getBillingState (#72); Checkout only for null, canceled and incomplete_expired (terminal in Stripe; one shared NO_SUBSCRIPTION in src/components/billing/status.ts, lead #79); incomplete, past_due and unpaid show the failed banner + 'Update card' and the plan with the "Past due" warn badge + 'Manage billing' (portal); paused shows the plan with the "Paused" warn badge + 'Manage billing'; the server actions never start a second Checkout; authCopy.checkoutClosed and its COPY.md stub row are deleted (lead Q2);
  - the header switcher (HeaderSwitcher in the /app layout) reads listMyBusinesses (name, city) + each business's latest run summary;
  - the cookie rank1_business (httpOnly, path /app) is set by selectBusinessAction after checking listMyBusinesses, and getCurrentBusiness(db, cookie) honors it in loadShell and the competitor actions;
  - Add/Remove failures reuse "We couldn't save that. Try again."; "We couldn't open billing…" is only for the Checkout/portal redirects (lead);
  - "Active"/"Paused" as screen-reader text are approved.
- Stripe calls: data-pipeline's #73 helpers (src/lib/stripe: startCheckout, openPortal, addBusinessSeat, removeBusinessAtPeriodEnd) with the caller's own client. Checkout success/cancel and the portal return to NEXT_PUBLIC_SITE_URL/app/billing. The interim stand-in module is gone.

## Step 16 (data-pipeline): white-label PDF and monthly send (branch feat/step16-report-pdf)
- Step 16 built from ENG_HANDOFF_OVERNIGHT §6 + UI.md 4b; Build Pack not readable; reconcile later.

Lead decisions (2026-11-05)
- Reports go to businesses whose workspace is active/trialing, or DFY: one per business per LA calendar month, for the previous month. Idempotent (enqueue_monthly_reports, 0019).
- /api/cron/monthly-report at "0 14,15 1 * *" UTC, gated to the 1st at 07:xx America/Los_Angeles. It only enqueues. The per-minute run-jobs drain renders and sends at most 2 reports per tick, each only with ≥60 s of maxDuration left.
- Content is stored data only (no LLM): logo or name + month, visibility with n and the change vs the previous month's last run, per engine, top 5 competitors, top 10 sources, open fixes (title + detail), the month's weekly checks, the "API-measured, directional" label + freshness. The brand color is used for accents only and falls back to ink when it fails 4.5:1 on white.
- White-label: no product name, logo or "Powered by" in the PDF (text and metadata) or the email. From = the business name at REPORT_FROM_EMAIL (existing env name).
- Copy: subject, body and headings exactly as COPY.md "Report (lead, 2026-11-05)".
- No GA4 section in the PDF, not even a placeholder, until Step 15 exists.
- Logos: PNG/JPEG only. SVG is rejected, not sanitized (data-pipeline's call, approved).

Changed
- `@react-pdf/renderer` (INTEGRATIONS.md) renders src/lib/reports/document.tsx (Helvetica, A4; title/author/creator/producer = the business name).
- src/lib/reports: month.ts (window + month label), contrast.ts (WCAG accent fallback), copy.ts, data.ts (buildReportData picks stored fields by name; monthRuns picks the month's runs by LA date), email.ts (Resend payload with the PDF attached; Idempotency-Key = report id), process.ts (processReports drain hook, runMonthly), service.ts (service wiring + sendTestReport).
- Errors leave a report 'rendering'. claim_reports retries it after 10 minutes and marks it failed after 3 attempts, so a Resend or Storage hiccup never loses a month and Resend's idempotency key prevents a double send. No recipients → status generated (stored, nothing sent).
- sendTestReport (for 'Send test to me'): last month's report to the signed-in user's own email only, read with the caller's client (RLS), never stored. The idempotency key dedupes double clicks within a minute.
- run-jobs drains reports after the fix checks. vercel.json gains the monthly cron, and tests/unit/vercel-config.test.ts pins all 3 crons.
- Logs carry counts and PG codes only.
- Review (#77): the drain reads with the service client, which bypasses the DFY fix_list_visible rule. So the report loader applies it: a DFY business with the fix list hidden gets no "What to fix next" section (no heading, no placeholder). DFY visible and self-serve always show it. Tested on the rendered PDF and the email.

## Fix (data-pipeline): exact percent floors (branch fix/exact-percent-floors)
- Bug (reviewer, Step 17): compute.ts floorPct did Math.floor(value × 100). Floating point makes 0.29 × 100 = 28.999…, so 29 of 100 showed as 28% in the leaderboard change, and progress bars were 1 low.
- One shared helper: floorPct(metric) = Math.floor(numerator × 100 / denominator), null at denominator 0. formatPercent (UI and the report PDF), pointsChange, History and progressPercent all use it. A test fails if any other src file floors a ratio × 100.
- Tests: 29/100, 57/100, 7/25, 58/200 give exact results in floorPct, formatPercent and progressPercent.

## Step 17 (backend): experiments (branch feat/step17-experiments-db, issue #80)
- Step 17 built from ENG_HANDOFF_OVERNIGHT §6 + UI.md 4b; Build Pack not readable; reconcile later.
- Lead decisions (2026-11-05):
  - Who: self-serve owners/members and the team on DFY. A dfy_client never sees or creates experiments (RLS refuses).
  - Setup: test = the questions the change affects; control = the business's other active questions, or a picked subset. Both ≥ 1, a question in one group only. change_url http/https only. change_date defaults to LA today and can't be in the future. From a fix, the name defaults to the fix title.
  - Math (no p-values, no significance language): ok answers of audit/weekly runs, on the LA date of runs.started_at. Before = [d-28, d), after = [d, d+28), cut at the LA date of ended_at (end day included). An answer's day is its run's started_at, not answers.checked_at (lead, 2026-11-06), so a run's answers stay in one window, as in History/listRunSummaries. n < 10 in any cell → "Too few answers to call yet." The label is always "Directional".
  - Status: 'running' until 28 days after change_date, then 'done' (derived, no cron). The user can end early ('ended', sets ended_at) and delete.
- Migration 20261105000020 (+ .down.sql), additive and re-runnable:
  - experiments: ended_at, status default 'running' + check running|ended, change_url check (NOT VALID, for legacy rows).
  - RLS: SELECT/INSERT/DELETE on private.can_write_business (0019) for both tables. No UPDATE, and no DELETE on experiment_questions (groups are fixed at creation; deleting a question cascades).
  - Deferred constraint triggers check at commit: both groups have a question, questions and the fix belong to the business, change_date not in the future (23514).
  - create_experiment(p jsonb) (invoker, 22023/42501), end_experiment(id) (definer, false when not running or not allowed), experiment_data(id) (invoker, counted like run_summaries).
- Queries: src/lib/queries/experiments.ts. src/types/db.ts got the 0020 objects by hand in the generator format.
- Window edges tested at d-29/d-28/d-1/d/d+27/d+28, the ended-early end day, and one minute before LA midnight on d (before) vs midnight (after), the 07:59Z/08:00Z case.
- tests/db/helpers.ts makeWorkspace now inserts its experiment with both groups in one transaction.

## Step 17 (data-pipeline): before/after vs control math (branch feat/step17-experiment-math)
- Step 17 built from ENG_HANDOFF_OVERNIGHT §6 + UI.md 4b; Build Pack not readable; reconcile later.

Lead decisions (2026-11-05)
- Not for dfy_client (backend RLS + no UI). No p-values and no significance language. The label is always "Directional".
- Before = ok answers of a group's questions in weekly/audit runs that started on LA dates D−28..D−1. After = D..D+27 (inclusive, 28 days each). D = change_date.
- A run counts by its start date (the LA date of runs.started_at), not answers.checked_at, so a run's answers never split across windows. Same as History (lead, 2026-11-06).
- Change = after% − before% in floored whole points, each with n. Difference = test change − control change.
- Any of the 4 cells with n < 10 → tooFew: the UI shows "Too few answers to call yet. Next check Monday." instead of numbers.
- Status: 'running' through D+27, 'done' from D+28. A user's early 'ended' wins.

Changed
- src/lib/metrics/experiment.ts (pure): computeExperiment(counts) → per group {before, after: Metric, change}, difference, tooFew, label. When tooFew, change and difference are null so no number can be shown by mistake. experimentWindows(D) and experimentStatus(e, now). The edge table went to backend for getExperimentData's db tests.

- Percents use the shared floorPct (fixed in #83: exact integer floors).

## Connections (backend): connections and change log (branch feat/connections-db, issue #84)
- Built from the founder's Connections spec (2026-11-06) and the lead's brief (briefs/rank1-connections.md).
- Lead decisions (2026-11-06):
  - Industry: the brief's businesses.industry is the existing businesses.vertical (lead O1), not a new column. 0021 adds a validated 13-value check (restaurant, hvac, plumbing, roofing, pest_control, auto, beauty, gym, events, dental, saas, dtc, other) with no row rewrite, so the migration fails if a row is outside the list. Onboarding and create_dfy_client accept business.vertical (default restaurant). The contact-us industry maps onto it via VERTICAL_FOR_INDUSTRY.
  - Apply edits: any self-serve member (can_write_business), or the team on DFY; never a dfy_client. This refines the brief's "owner (self-serve)" wording (lead Q1).
  - Connect/revoke: the business's own members, incl. its dfy_client (the one place a dfy_client writes, via OAuth only); never the team.
  - A Google grant is one business + one Google account (external_account_id = the Google sub, per data-pipeline). Its live gbp/search_console/ga4 connections share tokens, refreshes, needs_reauth and revoke. revoke_connection is grant-wide for Google, only itself otherwise. A null refresh token on save keeps the grant's stored one (Google omits it on re-consent).
  - The unused google_tokens table stays (dropping a table is a stop condition, lead Q2).
- Migration 20261105000021 (+ .down.sql):
  - connections (provider gbp | search_console | ga4 | shopify), connection_tokens (ciphertext, RLS on, no policies, no user grants), connection_changes (append-only: a trigger refuses UPDATE and any DELETE but the cascade; actor required; gbp fields only description, regular_hours, special_hours, website_uri, primary_phone, attributes), connector_interest (12 connector keys, shared with recommend.ts).
  - Reads: members (incl. the dfy_client) and the team on DFY. No user writes any of these tables directly.
  - Route checks (invoker): can_connect_business, can_apply_edits. note_connector_interest (idempotent).
  - Service RPCs: save_connection, get_connection_tokens (nothing once revoked), update_connection_tokens, set_connection_entities (≤ 100 {id, name}), set_connection_status (connected | needs_reauth), revoke_connection, record_connection_change.
- Queries: src/lib/queries/connections.ts (CONNECTOR_KEYS, GBP_EDIT_FIELDS). VERTICALS and VERTICAL_FOR_INDUSTRY in src/lib/queries/onboarding.ts. src/types/db.ts got the 0021 objects by hand in the generator format. docs/SCHEMA.md updated.

## Step 18 cleanup list
- Unused google_tokens table: drop with founder OK (lead, 2026-11-06).
- Capped free-audit lead UX: decide copy. When create_free_audit's own daily cap hits (P0429, a race past the route check), the lead already got the 202 "queued" answer; it stays stored with no run and gets no email (lead, 2026-11-06).
- Make create_free_audit's p.daily_limit required once every deployed build passes it. Until then a missing one skips the DB cap, because prod and preview share the hosted DB and v0.5.0 doesn't pass it (lead, 2026-11-06).

## Connections (data-pipeline): Google OAuth, GBP and Search Console (branch feat/connections)
- Built from the founder's Connections spec (2026-11-06) + the lead's decisions in briefs/rank1-connections.md. Behind ENABLE_CONNECTIONS.

Lead decisions (2026-11-06)
- One Google OAuth client with incremental scopes: GBP business.manage, Search Console webmasters.readonly, GA4 analytics.readonly. Each connector asks only for its own scope, plus openid for the Google sub that identifies the grant (no email or profile scope).
- The redirect URI is exactly NEXT_PUBLIC_SITE_URL + /api/connections/google/callback, never the request host. The lead registers prod + one stable Preview alias in the Google client.
- State + PKCE S256 in a cookie: httpOnly, Secure, SameSite=Lax, Path=/api/connections/google/callback, 10 minutes, cleared on every outcome.
- The id_token is read only from the token response: iss is accounts.google.com, aud is our client id, and it isn't expired (else exchange_failed). The sub is never logged or shown. A grant = the same business AND the same sub, so two Google accounts on one business stay separate (backend scopes the RPCs; both test suites cover it).
- Tokens are AES-256-GCM ("v1.iv.tag.ct", GOOGLE_TOKEN_ENCRYPTION_KEY) and only go through backend's service RPCs. Refresh happens within 60 s of expiry. invalid_grant, or a 401 after a refresh → needs_reauth, with no silent retries. Token saves, refresh and needs_reauth are grant-wide.
- Revoke: Google's revoke first (the whole grant), then revoke_connection (every Google connection on that grant). COPY.md has the confirm string. If Google can't be reached, nothing changes in Rank1.
- GBP edits: description, regular_hours, special_hours, website_uri, primary_phone and attributes only (the DB enforces the same list). Categories are out of v1, which is stricter than "team confirm" (approved). A preview diff → the team confirms → apply re-reads Google and refuses if the diff changed ("stale") → validateOnly → patch with an updateMask of exactly the changed fields → one change-log row per applied field.
- Open-redirect guard (lead): `return` must be a relative path under /app, /client or /team (safeNext: "/", not "//" or "/\\", no scheme). Anything else returns to /app/settings.
- NEXT_PUBLIC_SITE_URL unset or not https → start and callback answer 503 not_configured before Google. The request Host is never used (it's only set on prod for now).
- Every route 404s and every service function returns "disabled" unless ENABLE_CONNECTIONS is exactly "true".
- Fixtures only. A guard blocks any live call in the connections tests.

Changed
- src/lib/connections: recommend.ts (industry → connectors, the founder map, keyed by backend's CONNECTOR_KEYS; reads businesses.vertical), crypto.ts, oauth.ts, tokens.ts (withGoogleToken), google-api.ts, gbp.ts, search-console.ts, ga4.ts, service.ts (the entry points for routes and server actions: beginGoogleConnect, finishGoogleConnect, revokeGoogleConnection, listConnectionEntities, pickConnectionEntities, previewGbpEdit, applyGbpEdit).
- Routes: GET /api/connections/google/start and /callback.
- Picker picks are kept only if Google lists them for the grant (max 100).
- 'other' (incl. med-spa) has nothing recommended. gbp, search_console and ga4 are Optional for it (lead Q2, 2026-11-06).
- Tile helper text is a niche key. The strings are lead copy in COPY.md "Connections (lead, 2026-11-06)" (Q3).

Blocked/open
- R1 (founder): GBP API access needs Google's approval ("Application for Basic API Access", https://developers.google.com/my-business/content/prereqs). Quota is 0 QPM until then, so live GBP fails even on Preview. These are sensitive scopes, so external users also need Google OAuth verification.
- Shopify and the other connectors are Coming soon tiles (Notify me = backend's note_connector_interest).

## Step 16 (frontend): the report page (branch feat/step16-report-ui)

- Step 16 built from ENG_HANDOFF_OVERNIGHT §6 + UI.md 4b. The Build Pack isn't readable, so reconcile later.
- /app/report (nav "Reports", after "What to fix next") for the current business (switcher cookie):
  - getReportSettings, listReports and getLogoUrl (#76), read through RLS;
  - UI.md states: no reports → "Your first report sends on the 1st." + Preview; a failed latest report → "The report didn't send to {email}. Check the address." ({email} = the saved recipients, joined, because report rows carry a count only); plus loading and error.
  - The GA4 partial state isn't built (no GA4 integration yet).
- Preview: an iframe of the real PDF (data-pipeline's renderReportPdf). /dev/report-preview.pdf renders it on Example data for the gallery. The real GET /app/report/preview.pdf calls data-pipeline's renderReportPreview (#85) for the current business: application/pdf, inline, no-store; 404 when RLS hides it, 500 on a render error.
- Settings:
  - logo (PNG/JPEG ≤ 512 KB, checked in the browser and again by uploadLogo's magic bytes; SVG rejected);
  - Brand color (a native color picker, so always #RRGGBB);
  - Recipients (≤ 10 valid emails, one per line, lowercased and deduped).
  Save goes through setReportSettings (the definer RPC). 'Send test to me' → sendTestReport (the user's own email only).
- History: Month / Status / Download. Download is GET /app/report/{id}/download → a short-lived signed URL (302, no-store), and a 404 when RLS hides the row.
- Lead copy in COPY.md "Report (lead, 2026-11-05)".

## Step 16 QA fix (frontend): report GA4 partial state (branch fix/report-ga4-partial, issue #75, QA #89)

- F1: UI.md 4b Report partial. GA4 isn't connected yet, so the GA4 section is always hidden in the report UI (the PDF doesn't change). 'Connect GA4' links to /app/settings/connections (the Connections hub) only when ENABLE_CONNECTIONS is "true" (connectionsEnabled), so prod never shows a dead link. /dev/app gains report-partial.
- N1: the 404s of /app/report/preview.pdf and /app/report/{id}/download send Cache-Control: no-store too.

## v3 PR 1 (frontend): tokens and themes (branch feat/v3-tokens)

- Built from docs/design/v3.md and UI.md v3 (#90): D32-D36 and D40 (O2 for /app and /team, O1 for public pages).
- Tokens (src/styles/tokens.ts ↔ globals.css; tests/unit/tokens.test.ts):
  - the §7 dark values are the default @theme; [data-theme="light"] holds the O2 values; a later nested [data-theme="dark"] keeps the rail dark inside a light page (D14);
  - the names are unchanged ("white" = the panel/surface token in both themes), plus accent/onAccent (button fill), text2, overlay and borderStrong;
  - the §7 contrast pairs are asserted in both themes;
  - radius: control 6, card/surface/banner 8; shadows are hairlines except overlay menus and the Google button.
- Theme script (src/lib/theme.ts): one rule, themeFor(path, saved, prefersLight), used by tests and by the inline script in the root layout's <head>, which runs before first paint. Public pages are always dark. /app, /team, /client and /dev use the saved choice, else prefers-color-scheme, else dark. The server renders data-theme="dark", so public pages never change after paint. ThemeSync (a client effect in the root layout, inside Suspense) re-applies themeFor on every pathname change, so a saved light theme never carries onto a public page through a client-side link (#92 review). /app gets the "Dark theme" toggle (ThemeToggle, sharing /team's stored choice). The PDF report and the audit PNG keep the light palette.
- Fonts: Inter + JetBrains Mono via next/font (self-hosted at build, OFL); Fraunces and Public Sans removed. Mono placement and the type scale follow in the shell and landing PRs.
- Buttons (D35, lead O2): 6px radius; 32px from md (40px for size lg and the final CTA) and 44px below md, since UI.md keeps "44px below md". Press is translateY(1px) and the secondary arrow nudges on hover. The final CTA uses the accent (amber is no longer a button). A new `alt` variant. The Google button keeps its aurora ring on the 6px shape. The tap-target e2e checks run below md; dev-ui.spec checks 32/40px from md.
- Chart colours (lead O1, supersedes Step 9 Q3 O1 "4 solid + 2 striped"): dedicated per-theme series1-3 tokens, 3 solids + 3 stripes in both themes. Reddit/YouTube/Review sites are solid on series1/2/3; Social and News and blogs are striped in series1/2, and Other in neutral inkMuted. Dark #3987E5 / #D95926 / #199E70; light keeps #1A5FBF / #D98E2B / #279EF2. The dataviz validator (all pairs) passes in both themes; its output is in the PR.
- Docs: the old colour words in UI.md:159,200 and COPY.md:20,78,150,274 now use the v3 token names (visual notes only; quoted strings untouched).
## Step 18 (backend): hardening (branch fix/step18-hardening)
- Already done before this step (evidence in the PR): every cron route compares CRON_SECRET in constant time (cronAuthorized: SHA-256 digests + timingSafeEqual), and every cron/API 5xx body is a fixed label, never DB error text.
- Migration 20261105000022 (+ .down.sql):
  - bump_free_audit_notify_attempts(run) → the new count, one UPDATE (service only). bumpFreeAuditNotifyAttempts uses it instead of read-then-write (review #34).
  - claim_jobs: free-audit jobs still go first but take at most half a claim (rounded up) while paid jobs wait; slots paid work doesn't use go back to free audits. Output shape and order unchanged.
  - create_free_audit: p.daily_limit is a whole number (else 22023); the server passes auditDailyLimit(), so AUDIT_DAILY_LIMIT stays the one knob (lead Q1). Missing or null skips the DB cap so the live v0.5.0 build keeps working on the shared hosted DB (lead); the app-level check still runs. Under a transaction advisory lock it counts free audits since UTC midnight and raises P0429 at the cap. A lead that already has a run still gets it back. startFreeAudit already logs the code and returns no run (lead Q2: no new copy).
- README "Releasing": apply missing migrations to the hosted DB, then `notify pgrst, 'reload schema'`, before the deploy.
- Tests: the claim-order test now expects the half-and-half split (the rule changed, lead-approved). free-audit and e2e inputs pass daily_limit.

## v3 PR 2a (frontend): the /app shell (branch feat/v3-shell)

- Rail (D14): the App nav is the rail. It holds the logo, the pages in 4 groups with icons (Dashboard | Competitors, Questions, Sources | What to fix next, Reports, History | Billing) and Account at the foot. It's dark in both themes (rail token #0B0C0E, §7) and a sideways row on phones. During onboarding it keeps the logo and Account but no page links.
- Top bar (D42): a breadcrumb, Rank1 / business / page (aria-label "Breadcrumb", lead copy). The business crumb is the Business switcher (a 6px trigger, overlay popover); the theme toggle is on the right. The "/" separators are CSS ::before content, so the <ol> holds only <li>s.
- /dev/app renders every state inside the shell; the switcher states put the switcher in the breadcrumb.
- Theme on navigation: ThemeSync (#92) re-applies themeFor on pathname changes. The e2e covers the rail logo, the breadcrumb Rank1 and the /client header logo (local stack).
- Split (lead D1): 2a is /app; 2b is the /team shell (the client switcher listbox in the breadcrumb, the Context panel on the right, the document as main).

## v3 component drift (frontend, branch fix/v3-component-drift)

Found by the GAS prototype agent; lead list C1-C5 (2026-11-06), matched to docs/UI.md.
- C5 (bug from #93): the /app breadcrumb wrapped onto 3 lines at 375. The header is one row now: Rank1 and the page crumb don't shrink, and the business crumb gives way and ends in an ellipsis (data-crumb-name). The switcher trigger shrinks with it (a min-w-0 column), and its list keeps the full names. The e2e covers one line and no overlap at 375.
- C1: Badge is the UI.md tag (radius 4 = new radius token "tag", 20h, Inter 500 11px = new text token "tag", a 25% state hairline). ProgressBar is a 6px overlay track with the accent fill sized by scaleX; the labels are mono.
- C2: the error banner is errorBg with a 1px error hairline at 30%, a 48px Jelly and an Inter 500 sentence. The info banner is infoBg with a 25% hairline and a 28px chip.
- C3: UI.md has one type size at every breakpoint: text-ui 15/20 → 13/19, caption 13/18 → 12/16. R2 (lead O1): form fields stay 16px below md (one unlayered rule in globals.css), so iPhone Safari doesn't zoom on focus.
- C4: the FixList Status select is a 6px control (44px below md, 32px from md); the read-only status label is a Badge.
- The old v2 unit tests (pill badge, white banner with a 1.5px edge, ProgressBar width) now assert the v3 values above.
