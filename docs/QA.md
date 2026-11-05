# QA

## Step 3: Sign in + role routing

Checked 2026-11-05 on PR #14 (feat/step3-auth) at d7a54b0, its newest head. d7a54b0 is 69b8c47 plus one PROGRESS.md line and a stricter area-gate test: the signed-out case now runs for /app, /team and /client instead of /client only. PR #13 is merged on main as 889bcdb. Local checks ran in the agent sandbox with lean local Supabase (stopped afterwards). Preview checks ran on the Mac from a temporary detached worktree of d7a54b0 (removed afterwards).
Preview: https://rank1-ln005pqji-bryan-flowhighlevels-projects.vercel.app (git ref feat/step3-auth, sha d7a54b0, READY; hosted Supabase env from the Vercel integration).
TASKS.md has no Step 3 acceptance section, so the items below are the lead's list from ENG_HANDOFF_OVERNIGHT §6.

Result: FAIL. 2 blocking problems, listed at the end. Item 8 is partly verified and needs access, see below.

### Commands

| Command | Result |
|---|---|
| `pnpm test` | PASS. 32 files, 333 tests passed |
| `pnpm test:db` | PASS. 9 files, 198 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | PASS. exit 0 |
| `pnpm e2e` (sandbox, local Supabase, fresh build) | PASS. 150 passed, 2 skipped (client-secrets runs on desktop only, by design) |
| `E2E_BASE_URL=<preview> pnpm e2e` | FAIL. 102 passed, 47 failed, 3 skipped. All 47 failures are the same error, "Local Supabase is not running (missing API_URL)" (tests/e2e/helpers/auth.ts:9). Every test that signs a user in through the local service-role key fails instead of skipping on a deployed URL (tests/e2e/auth.spec.ts, tests/e2e/team-workspace.spec.ts). All other tests pass |

### Acceptance

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Supabase Auth, Google primary + magic link secondary, @supabase/ssr; proxy protects /app/**, /team/**, /client/** | PASS | src/proxy.ts + src/lib/supabase/middleware.ts (createServerClient, getClaims); signed-out visits redirect on local and preview (item 6) |
| 2 | First self-serve sign-in: exactly one workspace + owner membership; team/dfy_client get none | PASS | Browser run on the local stack: new self-serve user has 1 membership ("owner"), still 1 after a second sign-in. team and dfy_client have 0 after two sign-ins. test:db and auth.spec.ts:93/110/119 passed locally |
| 3 | Routing: team → /team, dfy_client → /client, owner/member → /app/onboarding with no business, else /app; sign out from the Account menu | PASS | Landed: owner without business /app/onboarding, owner with business /app, member of a workspace with a business /app, team /team, dfy_client /client. Sign out from the Account menu goes to /signin, then /app goes to /signin?next=%2Fapp |
| 4 | /signin matches UI.md "Sign in": 'Opening Google…', error banner, single column on mobile, copy in COPY.md | FAIL | Loading label, error banner and single column all match (Google button 303px = full content width at 375). Every visible string, aria-label, title and alt on /signin, its two error states, /app, /app/onboarding, /app/billing, /client and the Account menu is in COPY.md. But the Google button is the jellyDeep primary Button, not the Aurora button. Blocker 1 |
| 5 | "Start for $99/mo" and header "Log in" go to real routes; /signin → /app/billing paywall stub; no 404 | PASS | preview `/` links: `/signin` and `/signin?next=/app/billing`; /signin 200; /app/billing loads for an owner (H1 "Billing", disabled "Start for $99/mo", "Checkout isn't open yet.") |
| 6 | Signed-out /app, /team, /client → /signin (e2e) | PASS | preview: /app, /app/billing, /app/onboarding, /team, /client all 307 to `/signin?next=<path>`; e2e passed locally |
| 7 | Google OFF on hosted: banner path; flow works with a stub | PASS (expected gap) | preview: /auth/v1/settings says google=false, and clicking "Continue with Google" shows "Google sign-in didn't finish. Try again, or use an email link." in role=alert. Stubbed Google e2e (auth.spec.ts:41) passed local and preview. Expected gap: real Google pending Jeun's OAuth client |
| 8 | Magic link works for real on the preview | PARTLY VERIFIED | Send: on the preview, the form sent a link to Resend's test sink delivered@resend.dev (nobody receives it). Hosted Auth answered POST /auth/v1/otp 200, and the form showed "Check your email. We sent a sign-in link to delivered@resend.dev." Verify: the preview's /auth/callback with a bad token_hash goes to /signin?error=link, so hosted verifyOtp is wired. Not done: opening a real hosted link. That needs the hosted service-role key for admin generateLink, which exists only as a sensitive Vercel env (not readable), or a mailbox I control |

### Extra checks

| Check | Result | Evidence |
|---|---|---|
| No Supabase env: public pages 200, protected pages redirect | PASS | Sandbox build and start with no Supabase env: /, /contact, /privacy, /terms, /signin 200; /app, /app/billing, /app/onboarding, /team, /client 307 to /signin?next=… |
| Role gates, every role × area | PASS | Final page after the in-stream redirect settles (local stack). Signed out: all 5 areas go to /signin?next=. Owner/member: /app, /app/onboarding, /app/billing open; /team and /client go to their home. team: every /app* and /client go to /team. dfy_client: every /app* and /team go to /client. Raw HTML for a wrong-role request has none of the protected area's content |
| Sign out is same-origin only | PASS | local and preview: GET 405; POST with Sec-Fetch-Site cross-site 403, same-site 403, none 403; no Sec-Fetch-Site + foreign Origin 403; no headers 403; same-origin 303 to /signin |
| axe at 375 and 1280 | PASS | 0 violations on /signin, /signin?error=google, /signin?error=link, /, /app/onboarding, /app, /app/billing, /client and the open Account menu, at both widths; scrollWidth equals the viewport everywhere |
| No secrets in .next/static | PASS | Local build with local Supabase keys (28 files): the service-role value and JWT secret are absent; no server-only env name; the only pattern hit is supabase-js's own `startsWith("sb_secret_")` key-type check; the anon key is present, as expected |
| "Visuals for <sha>" comment matches the head | PASS | newest PR #14 comment is "Visuals for d7a54b0", and the head is d7a54b0 |
| Changed and removed tests | PASS | team-gate.test.tsx was added and removed inside this PR, and area-gate.test.tsx covers every role × area. gate.test.ts → gate.test.tsx, team-workspace.spec.ts and landing.spec.ts change only for the lead-approved behavior listed in PROGRESS.md (404s became the sign-in flow). d7a54b0 widens a test, it doesn't loosen one |

Not blocking:
- Without Supabase env, POST /auth/signout and GET /auth/callback return an empty 500 (createClient at src/app/auth/signout/route.ts:11 and src/app/auth/callback/route.ts:20). No leak, and both work on the preview.
- A wrong-role page answers 200 and redirects in the stream, because AreaGate is inside Suspense. No protected content is sent.
- A self-serve owner with no business can open /app directly (the Dashboard placeholder). Post-login routing still sends them to /app/onboarding.
- Can't check from here whether the hosted Auth redirect-URL allow-list includes preview domains. Without that entry, emailed links would fall back to the Site URL.

### Blocking problems

1. src/components/auth/SignInForm.tsx:84: "Continue with Google" is the jellyDeep primary `Button`. docs/UI.md:91 and docs/PRODUCT.md (design) make the aurora ring the Google sign-in button, and the Final set shows "Opening Google…" as the Aurora pill. AuroraButton (src/components/ui/AuroraButton.tsx) is unused outside /dev/ui. COPY.md's "Google button (primary)" names the role, not the style. If the lead decides the jellyDeep pill is intended, record that in UI.md and this item passes.
2. `pnpm e2e` against the preview is red: 47 failures, all "Local Supabase is not running" from tests/e2e/helpers/auth.ts:9. The local-stack tests in tests/e2e/auth.spec.ts and tests/e2e/team-workspace.spec.ts need a `test.skip(Boolean(process.env.E2E_BASE_URL), …)`, as in tests/e2e/client-secrets.spec.ts:32, or a hosted test path.

Needs access, not a code fix: item 8's last step (open a real hosted magic link on the preview). It needs the hosted service-role key in ~/Desktop/rank1.us/.env.local for one admin generateLink call, or the lead running that call.

## Step 2: Public site, contact, legal, audit request (re-run)

Checked 2026-11-05 on commit 61e708d (branch step-2). It adds these since the first QA run (8b51609): the tablist labelled by its H2 (e32ca86), a clean /api/contact 500 (ba87fae), migration 20261105000007 for industry and fix-list visibility (6954380), and the Industry field (61e708d). Build, test and test:db ran in the agent sandbox (lean local Supabase, stopped afterwards). Preview e2e, probes and screenshots ran on the Mac from a temporary detached worktree of 61e708d.
Preview: https://rank1-bhrtg4v85-bryan-flowhighlevels-projects.vercel.app (git ref step-2, sha 61e708d, built 08:48 UTC, after the preview env updates at 08:32-08:39 UTC).

Result: PASS. No blocking problems. The first run's blocker ("Example screens" aria-label) is fixed.

### Commands

| Command | Result |
|---|---|
| `pnpm test` | PASS. 19 files, 163 tests passed |
| `pnpm test:db` | PASS. 7 files, 183 tests passed |
| `pnpm typecheck` | PASS. exit 0 |
| `pnpm lint` | PASS. exit 0 |
| `pnpm e2e` (sandbox, `.next` deleted, fresh build) | PASS. 83 passed, 1 skipped (client-secrets runs on desktop only, by design) |
| `E2E_BASE_URL=<preview> pnpm e2e` | PASS. 82 passed, 2 skipped (client-secrets skips on a deployed URL, by design) |

### TASKS.md step 2

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `/` from UI.md 4a: 9 sections, header, footer, meta; social proof behind SHOW_SOCIAL_PROOF=false | PASS | landing.spec.ts passed local and preview; page.tsx renders SocialProof only when `SHOW_SOCIAL_PROOF === "true"`; .env.example `SHOW_SOCIAL_PROOF=false` |
| 2 | Only the existing Jelly asset | PASS | the only Jelly reference in src is `/jelly.png` (Jelly.tsx:8) |
| 3 | /privacy and /terms placeholders; Privacy names Google sign-in, GA4 read-only, deletion on request | PASS | legal.spec.ts passed; no DO NOT USE item (grep: 0) |
| 4 | /contact + modal; tiers with no $ | PASS | contact.spec.ts passed; tiers Agency bundle, Done-for-you (custom), Other |
| 5 | /api/contact: honeypot, Turnstile, 3/IP hash/hour, contact_requests row, Resend from env, no hard-coded address | PASS | tests/db/forms.test.ts (incl. "stores industry Other with its text") and routes.test.ts passed; email text has `Industry: Restaurant` / `Industry: Other – Pool service` (resend.test.ts, routes.test.ts) |
| 6 | Audit CTA posts to /api/audit/request | PASS | landing.spec.ts and audit-form.spec.ts passed |
| 7 | Final set source of truth; weekly checks + monthly report wording | PASS | cadence grep unchanged since the first run: "every week", "every weekly check kept in History", "monthly report"; no "daily" |
| 8 | All green locally; preview builds; e2e passes on it | PASS | commands above |

### Jeun's ENG_HANDOFF locks

| Lock | Result | Evidence |
|---|---|---|
| Industry list is exactly the 6 | PASS | INDUSTRIES = Restaurant, HVAC, Plumbing, Roofing, Pest control, Other (src/lib/queries/contactRequests.ts:7); DB check constraint has the same 6 (migration 0007); preview /contact options: "Pick your industry." + the 6, at 375 and 1280 |
| No dental | PASS | grep -i dental in src: 0. Preview POST with industry "Dental": 400 `{"errors":["industry"]}` |
| No $ on the form | PASS | preview /contact main text contains no "$" (375 and 1280); contact.spec.ts asserts the same on /contact and the modal |
| Industry in the email body | PASS | resend.ts plain text adds `Industry: <value>` and `Industry: Other – <text>`; resend.test.ts asserts exact text and no html body |
| Other text optional, max 60, only with Other | PASS | preview POST: HVAC + text 400 `industry_other`, Other + 61 chars 400 `industry_other`, no industry 400 `industry`; DB constraints in 0007 |
| Fix list visible per service | PASS | step2-migration.test.ts: self-serve member sees fixes; dfy member sees none until the service role sets fix_list_visible; service role always sees them; owners cannot set service or fix_list_visible on insert or update |
| Audit cap 5 on preview | NOT VERIFIABLE | AUDIT_DAILY_LIMIT is a sensitive Vercel env (value unreadable through the API). It was updated 08:39 UTC, before the 08:48 build. The cap can't be exercised on the preview without Supabase. Not blocking: it's config, not code |

### Migration 20261105000007

| Check | Result | Evidence |
|---|---|---|
| Rollback round-trip, 7 migrations | PASS | migrations.test.ts "rollbacks undo everything in reverse order, and the migrations re-apply after" passed. Manual psql run: after db reset, 22 tables, 4 new columns, 25 policies, 11 private functions; after the 7 .down.sql in reverse, 0, 0, 0, 0; after re-applying the 7 migrations, back to 22, 4, 25, 11 |
| Fix-list RLS in test:db | PASS | 6 cases in step2-migration.test.ts passed; rls.test.ts cross-workspace fixes read, insert, update, delete still denied |
| service and fix_list_visible are service-role only | PASS | 0007 revokes table grants and re-grants INSERT/UPDATE on every other column only; owner insert/update tests passed |

### Tests diff since 8b51609

PASS. No assertion removed or loosened. Every changed line adds the industry field to a fixture or expectation (forms.test.ts, rls.test.ts, routes.test.ts, resend.test.ts, validate.test.ts), or extends a list (contact.spec.ts invalid-field loop now includes Industry). `landing.test.tsx` passes the new `labelledBy` prop. New: step2-migration.test.ts, missing-env.test.ts, industry e2e on /contact and the modal, an aria-label/title/alt check against COPY.md.
routes.test.ts:11 now mocks `@/lib/queries/contactRequests` as `{ ...real, ...q }`. All 3 query functions the route calls are still replaced by `q` mocks. The real exports kept are only INDUSTRIES, INDUSTRY_OTHER_MAX and types, which validate.ts imports. Harmless.

### Standing checks

| Check | Result | Evidence |
|---|---|---|
| Unmocked API on the preview fails cleanly | PASS | /api/contact with a valid body + Turnstile test token: 500 `{"error":"server"}` (was an empty 500). /api/audit/request: 500 `{"error":"server"}`. No token: 403 `{"error":"turnstile"}`. No stack, path or secret in any response |
| Visible strings on /, /contact and the modal in COPY.md | PASS | Script compared every visible text node, placeholder, aria-label and option to COPY.md: 0 missing on /, /contact and the modal. The old "Example screens" is gone |
| Legal pages: no DO NOT USE items | PASS | grep: 0 |
| Only price $99; tiers and industry have no $ | PASS | every `$<digits>` in src is `$99` |
| SHOW_SOCIAL_PROOF off by default | PASS | see item 1 |
| Jelly only public/jelly.png | PASS | see item 2 |
| One jellyDeep primary per viewport; 375px scroll only in the comparison table; sticky bar clear of the footer | PASS | landing.spec.ts passed local and preview; preview scrollWidth 375 / 1280 on / and /contact |
| Axe on every page | PASS | /, /contact, /privacy, /terms and the open modal: 0 violations; e2e axe checks passed, incl. /contact and the modal with Other picked |
| No secrets in .next/static | PASS | 24 files: no secret patterns, Turnstile test secret, canary salt or server-only env names |
| No hard-coded email in src | PASS | only "you@ramenhouse.com" inside the approved COPY.md email error (forms/copy.ts:26) |

Screenshots (preview, full page): docs/qa/landing-after-375.png, docs/qa/landing-after-1280.png, docs/qa/contact-industry-375.png, docs/qa/contact-industry-1280.png (Other picked, fake data "Ana Example", "Pool service")

### Blocking problems

None.

## Components v2: Final set

Checked 2026-11-05 on commit 9ef40cb (branch components-v2, off main 2938e46). Local runs in the agent sandbox. Preview e2e ran on the Mac from a temporary detached worktree of 9ef40cb (removed afterwards).
Preview: https://rank1-qka606x4q-bryan-flowhighlevels-projects.vercel.app (Vercel API: git ref components-v2, sha 9ef40cb, READY).
Design source: the "Final set" screenshot Jeun adopted on 2026-11-05.

Result: PASS. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` | PASS. 11 files, 77 tests passed |
| `pnpm typecheck` | PASS. exit 0 |
| `pnpm lint` | PASS. exit 0 |
| `pnpm e2e` (sandbox, `.next` deleted, fresh `next build`) | PASS. 22 passed |
| `E2E_BASE_URL=<preview> pnpm e2e` | PASS. 22 passed |

### Changed tests (`git diff origin/main -- tests/`)

| Test | Old → new | Result |
|---|---|---|
| button primary | `h-11`, `rounded-card`, `not rounded-full` → `h-12`, `rounded-full`, `shadow-button`, `bg-jellyDeep`, `text-white`, `not rounded-card`; class match is now exact-token | PASS. Same strictness for the new pill spec; 48px still clears 44px |
| button secondary | `not bg-` → `not bg-\|shadow` + aria-hidden arrow | PASS. Stricter |
| button loading | "Opening Google…" → "Checking…" + `bg-jellyLoading`, `rounded-full`, spinner `motion-reduce:animate-none`; disabled + aria-busy kept | PASS. "Opening Google…" with disabled + aria-busy is now asserted on AuroraButton (final-set.test.tsx) |
| button disabled | new | PASS |
| tokens colors | 14 → 19 values | PASS |
| tokens palette | colors + "white" → colors (white became a token) | PASS. Same check |
| tokens "no gradients or shadows" | → exact radius and 7 shadow tokens, no other `--shadow-*`, no raw box-shadow; the only gradients are the aurora token and the ring's white padding layer; components use no arbitrary shadow/gradient and only AuroraButton uses `aurora-ring` | PASS. The ban became an allow-list of exactly what docs/PRODUCT.md (was CLAUDE.md) now allows |
| Banner error/info | `bg-errorBg`/`bg-infoBg` → white, 1.5px edge, rounded-banner, shadow token, info chip; 64px Jelly, one sentence, one link kept | PASS |
| Card | paper, border, radius 8, no shadow → white, radius 24, shadow-card, no border | PASS. Follows the new UI.md Card row |
| EmptyState | one link → one submit button "Add my business", labeled "Your domain" input, 0 links; Jelly 64-96px kept | PASS. Still exactly one action |
| LoadingState | one string → message + "120 of 250 answers" + computed "48%" + progressbar aria-valuenow; squish and spin stop for reduced motion | PASS. Stricter |
| e2e dev-ui | heading list grows to 13, `exact: true` | PASS. Stricter. Axe, 375px scrollWidth, fonts, background and tap-target assertions unchanged |
| e2e dev-ui-example-data | label list adds DomainField, ProgressBar, Final set | PASS |

No assertion removed or loosened. Every change listed in PROGRESS.md matches the diff.

### docs/PRODUCT.md (was CLAUDE.md) `<design>`

PASS. Removed from the ban list: "gradients", "drop shadows", "pill-shaped primary buttons (pills only for badges)". Added: pills for primary buttons and fields, shadows from the shadow tokens only, and one gradient (the aurora ring on Google sign-in only). Still banned: dark mode, donut/Sankey/gauge/heatmap charts, italic accent words in headlines, numbered 01/02/03 eyebrow labels, monospace labels. "One primary button per screen" and the empty/loading/partial/error/success + mobile rule are unchanged.

### Standing checks

| Check | Result | Evidence |
|---|---|---|
| New UI strings are in COPY.md | PASS | Field placeholders "yourbusiness.com" and "yoursite.com", "Checking…", "Add the ending, like ramenhouse.com", "Add business", sr-only label "Your domain" are in the COPY.md Final set table. "Opening Google…", "Checking 4 AI engines…", the empty message, the banners and "See pricing" are existing COPY.md strings. Row notes ("Field + Button. Default, focused, loading, error." etc.) are gallery labels on a dev-only page |
| No hand-typed numbers | PASS | "48%" is `progressPercent(120, 250)` (ProgressBar.tsx:3, floored); "120 of 250 answers" is built from exampleProgress in example-data.ts. Domains come from exampleDomain / exampleDomainNoEnding. The only "%" literal in src/components or /dev/ui is the hover color-mix in Button.tsx:14 |
| Axe | PASS | dev-ui.spec.ts axe assertion, mobile and desktop, local and preview |
| 375px no horizontal scroll | PASS | scrollWidth 375 at 375px, 1280 at 1280px; e2e scroll assertion passed |
| DomainField stacks when narrow | PASS | e2e "inline when wide, button below when narrow" passed on mobile and desktop; screenshot at 375px shows the button under the input in every state |
| Tap targets >= 44px | PASS | dev-ui.spec.ts:28 passed, local and preview; primary pills are h-12, field 60px |
| Reduced motion | PASS | e2e "reduced motion stops every spinner and the Jelly squish": every `[data-spinner]` and squish image has animation-name none under `reduce`, and spinners move again under `no-preference` |
| No secrets in .next/static | PASS | 20 files: no `sk_(test\|live)_`, `whsec_`, `service_role`, `sb_secret_`, JWT, `pplx-`, `re_`, `GOCSPX-`; no server-only env name |
| DO NOT USE grep | PASS | no match in src |
| Preview builds the same styles | PASS | preview CSS chunk and the local build chunk are both 24,640 bytes with identical `--color-*`, `--shadow-*`, `--radius-*` declarations (sha256 of the sorted declarations matches); /favicon.ico 404 |

### Visual: /dev/ui "Final set" vs the design screenshot

Compared at 1280px and 375px (local build of 9ef40cb in the sandbox; the preview serves the same CSS).

Expected and approved: Fraunces/Public Sans instead of the design's fonts; solid fills instead of the faint fill gradients; loading blue #316FC5; field border ink 50%; error Jelly 64px.

Other visible differences (none blocking):
1. The Final set card sits on the paper background under an extra gallery H2 "Final set" and an "Example data" badge, so the title shows twice. The design is a white canvas with one title.
2. Field text and placeholders are 15px (text-ui). The design's look larger, about 18px.
3. Left column titles ("Get my free audit", "Banners") are 15px semibold. The design's are larger, and "See pricing · Add business" wraps to two lines at 1280px where the design keeps one.
4. The design has no mobile layout. At 375px every field stacks (button full width under the input, radius 28), which the spec asks for.

Everything else matches: four field states with the right edges (fieldBorder, 2px jellyDeep focus, lighter blue busy button, 2px brick with the brick error line), the aurora "Opening Google…" pill, the arrow text link and the lock disabled pill, the white error and info banners with "Try again →" and the i chip, freshness with the clock, and the empty and loading cards with a 48% bar.

### Blocking problems

None.

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
