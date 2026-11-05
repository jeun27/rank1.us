# QA

## Step 5: Local competitors + restaurant onboarding

Checked 2026-11-05: the merged backend and data-pipeline work on main, plus the onboarding UI in PR #21 (feat/step5-onboarding) at b8453fd, its head:
- #20 (227a30f): onboarding RPCs, seat rule, DFY create, fixes RLS
- #23 (a7e6d31): Maps adapter, readSite, suggestQuestions, CUISINES
- #24 (57c0000): take_rate_token, lookup_cache

The sandbox Docker disk is full, so per the lead there was no local Supabase. test:db and e2e come from CI on #21 (run 42028278532 at b8453fd). Unit, typecheck, lint, format and build ran locally in the sandbox. The preview checks ran on the Mac from a temporary detached worktree of b8453fd (removed afterwards). No live Maps, site or engine calls (no keys).
Preview: https://rank1-9uifpq0e4-bryan-flowhighlevels-projects.vercel.app (sha b8453fd, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §6 Step 5, the lead's brief (rank1-step5.md), docs/UI.md 4b Onboarding 1/2/3.

Result: FAIL. 1 blocking problem: e2e against the preview is red. It isn't caused by #21's code. Listed at the end.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox) | PASS. 47 files, 665 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on #21 at b8453fd | PASS. 9 of 9; test-db 11 files / 261 tests, e2e 176 passed |
| `E2E_BASE_URL=<preview> pnpm e2e` | FAIL. 114 passed, 60 skipped, 4 failed. All 4 are tests/e2e/admin-test.spec.ts:48 and :56 (×2 viewports), with "Local Supabase is not running". The onboarding specs pass or skip cleanly, and dev-onboarding.spec.ts passes on both viewports |

### Acceptance

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Restaurant template; ≤25 questions; short + long; location level per question, greyed where an engine can't, with tooltip copy | PASS | onboarding.test.tsx "lists the template questions (25 max), tracked, city level, both forms editable", "city and state levels grey ChatGPT and Gemini with the tooltip copy; country doesn't"; cuisines-questions.test.ts (never > 25); preview gallery step 3 shows the filled templates and "{Engine} can't target a city yet, so we check it for the whole country." |
| 2 | Maps local competitors: top 5 pre-ticked, manual add, <3 partial, 0 empty, error/missing_keys fallback | PASS | maps.test.ts (docs field names, top 5 in Maps order, own domain excluded, missing_keys without a request); onboarding.test.tsx step 2 cases for 5 ticked, < 3 + manual prompt, none → empty message, error and missing_keys → message + manual form |
| 3 | readSite: robots, 1 MB stream cap, SSRF guard; unreadable → "Type 3 things you sell"; cuisine not found → highlighted select | PASS | read-site.test.ts: robots Disallow / and /menu, Rank1 group rules, 1 MB stream cut and Content-Length refusal, private-address refusal (v4, v6, mapped, NAT64), same-site redirects only, timeout → unreadable. Code: siteHost rejects IP literals and internal names, DNS check before every hop, manual redirects. onboarding.test.tsx: unreadable → 3 inputs; no cuisine → highlighted select, Next off |
| 4 | Finish setup saves business + competitors + questions atomically → /app | PASS | onboarding.test.ts (db): creates all three; "is atomic: a bad question rolls back the business and competitors"; > 25 active rejected, nothing stored. finishAction redirects to /app (actions.test.ts). CI e2e "a new owner sets up a business in 3 steps and lands on /app" |
| 5 | Unpaid workspace: exactly 1 business; 2nd blocked; DFY exempt | PASS | db: "0 seats: the first active business is allowed, the second is blocked (service role too)", "an unpaid workspace cannot onboard a second business", "dfy businesses are exempt", "2 paid seats: two, not three" |
| 6 | create_dfy_client: service='dfy', fix_list_visible=false, team-only | PASS | db: "a team user creates a client workspace and a hidden-fix-list dfy business"; "self-serve and dfy_client users are denied; anon too"; smuggled service / fix_list_visible ignored |
| 7 | Fix list: team sees and edits; dfy_client only when visible, never writes; self-serve unchanged | PASS | db "fixes visibility and writes by role (closes #9)": the 3 cases |
| 8 | Rate limits: read_site 10/h, maps 5/h + 20/day; 24 h cache, no token on a hit; over limit → fallbacks; only onboarding users trigger lookups | PASS | take_rate_token fixes the limits in SQL with a per-user advisory lock. db rate-limits.test.ts covers 10/h, 5/h, 20/24 h, parallel calls, no caller limits and no direct table access. lookup_cache is per user, kind and key, service-role only. actions.test.ts covers signed out, team, dfy_client and dashboard users getting fallbacks with no fetch or Maps call, the over-limit fallback, and a cache hit with no token and no paid call. limits.test.ts: failed or keyless results count but aren't cached |
| 9 | All 4b states: mobile < 768, 44px targets, axe clean, copy in COPY.md, Example data only, no LLM | PASS | preview /dev/onboarding at 375 and 1280: axe 0 violations, scrollWidth equals viewport, all 102 checkbox labels 44 or 56 px tall. CI e2e "tap targets are at least 44px on every step" and keyboard-only. Every visible string, aria-label and title is in COPY.md or is a COPY.md/UI.md template filled with Example data (question forms, the tooltip, "Finding ramen places in Irvine…"), a cuisine option or a gallery label. onboarding/copy.test.ts passed. Gallery brands are "Example …" with example.test domains, and places are the UI.md Irvine list. No LLM: no-llm-sdk.test.ts passed, and no LLM name in the page |

### Extra checks

| Check | Result | Evidence |
|---|---|---|
| Signed-out /app/onboarding | PASS | preview: 307 to /signin?next=%2Fapp%2Fonboarding |
| Real magic-link onboarding on the preview | NOT RUN | needs a mailbox or the hosted service-role key. The full flow is CI e2e "a new owner sets up a business in 3 steps and lands on /app" on the local stack |
| No secrets in .next/static | PASS | 31 files: no server-only env name or secret pattern; no api.dataforseo.com, maps/live, take_rate_token or lookup_cache in the client bundle |
| "Visuals for <sha>" matches the head | PASS | newest #21 comment is "Visuals for b8453fd", and the head is b8453fd |

Not blocking:
- readSite checks DNS, then fetch resolves again (a small DNS-rebinding window). Low risk: only a name and a cuisine come back to the user.
- A same-site redirect may change the port (e.g. :8080) on the same public host.
- At state level the greyed tooltip still says "can't target a city yet" (the only UI.md copy).

### Blocking problems

1. e2e against the preview is red: tests/e2e/admin-test.spec.ts:48 ("another signed-in user gets a 404") and :56 ("the founder sees the form…") use the local service-role helpers without the `test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase")` every other local-stack test has. This came in with #19 (on main), not #21. My Step 4 report missed it because e2e came from CI only. Add the skip, in #21 or a small PR.

## Step 4: Engine adapters with fixtures + /admin/test (re-run)

Checked 2026-11-05: the adapters on main at d4962b9 (#16), and /admin/test in PR #19 (feat/admin-engine-test), first at d201823 and re-checked at 3241698, its head. 3241698 = c21ac6f (proxy gates match the normalized path) + a merge of main (#20). The sandbox Docker disk is full, so per the lead there was no local Supabase. test:db and e2e come from CI on #19 (9 of 9 green at d201823 and again at 3241698). Unit, typecheck, lint, format, smoke and build ran locally in the sandbox. The 404 checks ran from the Mac on the Vercel previews of d201823 and 3241698.
Preview: https://rank1-1k0aomd6u-bryan-flowhighlevels-projects.vercel.app (git ref feat/admin-engine-test, sha 3241698, READY). FOUNDER_EMAIL and the engine keys are not set on Vercel.
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §6 Step 4 and the lead's brief (rank1-step4.md).

Result: PASS. Both blockers from the first run (d201823) are fixed. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, 3241698) | PASS. 40 files, 578 tests passed (incl. path-normalize.test.ts and proxy-admin.test.ts, 92 tests) |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` (sandbox) | PASS. exit 0 |
| `pnpm smoke:engines` without keys (sandbox) | PASS. exit 0, prints "skipped: no keys (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, PERPLEXITY_API_KEY)" |
| `pnpm build` (sandbox) | PASS |
| CI on #19 at 3241698 | PASS. 9 of 9: typecheck, test, test-db, lint, format, e2e (164 passed, 2 skipped; the count includes admin-test.spec's 3 tests × 2 viewports), signoff, Vercel, preview comments |

### Acceptance

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | 4 adapters return EngineAnswer | PASS | src/lib/engines/{chatgpt,gemini,google-aio,perplexity}.ts via `runEngine` (index.ts); adapters.test.ts parses each fixture into an EngineAnswer |
| 2 | Citations are only returned links, in order | PASS | `toCitations` (shared.ts) keeps every returned link in order and skips only entries without a url. Tests: "citations are exactly result.sources, in order" (ChatGPT, Gemini), AIO references in order, Perplexity search_results in order with repeats kept |
| 3 | ChatGPT/Gemini state/city → country + fallback_country; Perplexity exact only for the level sent; AIO no overview → no_overview | PASS | llm-scraper.ts always sends the country code and returns fallback_country unless the level is country. perplexity.ts returns exact only when the sent level equals the requested one (an unknown state code falls back). google-aio.ts returns no_overview without an ai_overview item. All covered by adapters.test.ts |
| 4 | Errors, timeouts, non-20000 → failed, no throw | PASS | `settle` turns every error into status failed with `error` set. failures.test.ts: HTTP 400/401/404/429/500/502/503, timeout, network error, non-JSON, missing keys, for all 4 engines. DataForSEO top-level 40100 and task 40501 → failed |
| 5 | Fixtures are synthetic Example data, no real businesses or personal data | PASS | fixtures-privacy.test.ts: no phones, emails or filled address/phone fields in any fixture; synthetic fixtures link only to example.test. The `docs-*` files are the official docs examples, copied unedited as the brief allows (Gemini: Albert Einstein facts; Perplexity: AI-trend articles from Stanford, MIT, IBM, Microsoft). They name no local businesses and hold no personal data. The ChatGPT and organic-SERP docs examples name real cafés and hotels, so those two are synthetic (tests/fixtures/engines/README.md) |
| 6 | No LLM SDKs | PASS | no-llm-sdk.test.ts (package.json, src/ imports, plus a control case); my own `git grep` for openai, @anthropic-ai, @google/genai, @google/generative-ai, cohere, @mistralai, langchain, ai: 0 matches |
| 7 | `pnpm smoke:engines` skips cleanly without keys | PASS | see Commands |
| 8 | /admin/test founder-only, real 404 otherwise; form; mocked results; missing keys; axe 375/1280; copy; raw server-side | PASS | Preview of 3241698, FOUNDER_EMAIL unset, every case below has no form in the body. Real 404: /admin, /admin/test, /admin%2Ftest, /%61dmin/test, /admin%252Ftest, /%2561dmin/test, /./admin/test, /x/../admin/test, /ADMIN/test, /Admin, /admin%5Ctest, /%E0%A4 (bad UTF-8), and the server-action POST to /%61dmin/test. //admin and //admin/test: 308 to /admin and /admin/test, which are 404. /%E0%A4%A: Vercel's edge resets it (HTTP/2 stream error) before the app. CI e2e: signed-out and encoded-path 404s, another user 404, founder form + fake-engine results, axe and no side scroll at 375 and 1280. Unit: missing-keys message, Run test disabled, `raw` dropped. Copy in COPY.md "Admin (lead, 2026-11-05)" |
| 9 | API URL overrides ignored on Vercel production | PASS | `apiBase` (shared.ts:67) returns the official host when VERCEL_ENV is production, and accepts only loopback hosts elsewhere; 3 unit tests. Neither override is set on Vercel |

### Standing checks

| Check | Result | Evidence |
|---|---|---|
| No secrets in .next/static | PASS | 29 files: no server-only env name, no secret patterns, no Basic auth header. No engine code reaches the client (no api.dataforseo.com, api.perplexity.ai, llm_scraper, ai_overview or user_location in the bundle) |
| "Visuals for <sha>" matches the head | PASS | newest #19 comment is "Visuals for 3241698" (no UI change since 87824a2, same images from this sha); the head is 3241698 |
| Step 3 gates on encoded paths | PASS | same preview: /%61pp, /te%61m, /%63lient, /./team and /APP 307 to /signin?next=…; //app → 308 /app → /signin. Look-alikes stay ungated (no sign-in redirect): /application, /teams, /clients, /administrator, /admins are the router's plain 404 |

Not blocking:
- The Status row shows the raw status value and the engine error text ("failed: DataForSEO 40100: …"). That's fine for a founder-only debug page, and no secret can reach it.
- An invalid form post (unknown engine or level, an empty question, or more than 500 characters) returns nothing visible.
- Run test is disabled when any of the 3 keys is missing, so DataForSEO engines can't be tried until the Perplexity key exists too.

First-run blockers (d201823):

| Blocker | Result | Evidence |
|---|---|---|
| 1. Visuals comment was for 87824a2, not the head | FIXED | "Visuals for 3241698" matches the head |
| 2. Encoded /admin paths returned HTTP 200 | FIXED | src/lib/auth/path.ts `normalizePath` (repeated percent-decoding, slash/backslash split, dot segments, lowercase; malformed → 404) runs before `isAdminPath` and `isProtected` in src/lib/supabase/middleware.ts. Preview results in item 8 |

### Blocking problems

None.

## Step 3: Sign in + role routing (re-run)

Checked 2026-11-05 on PR #14 (feat/step3-auth) at 61ace35, its newest head. Since the first run (d7a54b0) it adds:
- 9306349: AuroraButton for Google, a config redirect when Supabase env is missing, preview-safe e2e skips
- dda5533 + 97d6a76: token_hash email links, `next` in an httpOnly cookie set by POST /auth/next, verifyOtp in the callback, error=link for fragment-only or failed links
- 8f77f11 + 2cca5c8: the /signin?error=config banner
- 61ace35: POST /auth/next is same-origin only, through a shared helper that sign-out also uses

I ran the full suite on 97d6a76, 2cca5c8 and 61ace35 as each landed. The numbers below are from 61ace35. Local checks ran in the agent sandbox with lean local Supabase (stopped afterwards). Preview checks ran on the Mac from a temporary detached worktree (removed afterwards).
Preview: https://rank1-n70dastqe-bryan-flowhighlevels-projects.vercel.app (git ref feat/step3-auth, sha 61ace35, READY, hosted Supabase).
Hosted Auth (lead): Magic link and Confirm signup templates use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=magiclink|signup`. The redirect allow list is rank1.us, www and *-bryan-flowhighlevels-projects.vercel.app.

Result: PASS. Both blockers from the first run are fixed. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` | PASS. 33 files, 362 tests passed |
| `pnpm test:db` | PASS. 9 files, 198 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | PASS. exit 0 |
| `pnpm e2e` (sandbox, local Supabase, fresh build) | PASS. 158 passed, 2 skipped (client-secrets on desktop only, by design) |
| `E2E_BASE_URL=<preview> pnpm e2e` | PASS. 106 passed, 54 skipped, 0 failed. The skips are the local-stack sign-in tests plus client-secrets, which skip on a deployed URL |

One sandbox run on 97d6a76 failed test:db and e2e with "fetch failed" / "supabase status" errors. test:db's own `db reset` was still restarting the local containers when the next step ran. Re-run after the stack was healthy: all green. Not a code problem.

### First-run blockers

| Blocker | Result | Evidence |
|---|---|---|
| 1. Google button was the jellyDeep primary, not the Aurora button | FIXED | src/components/auth/SignInForm.tsx uses AuroraButton. Preview /signin: "Continue with Google" has `aurora-ring`, 1 aurora ring on the page, 0 jellyDeep primary buttons. Unit tests assert the aurora on idle and on "Opening Google…" (disabled, aria-busy), and that the magic-link submit is not a second aurora |
| 2. 47 e2e failures on the preview ("Local Supabase is not running") | FIXED | preview run above: 0 failed, local-stack tests skip cleanly |

### Acceptance

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Supabase Auth, Google primary + magic link secondary, @supabase/ssr; proxy protects /app/**, /team/**, /client/** | PASS | proxy unchanged apart from the shared `supabaseEnv()`; preview /app, /team, /client 307 to /signin?next= |
| 2 | First self-serve sign-in: one workspace + owner; team/dfy_client none | PASS | local e2e (auth.spec.ts) and test:db passed; first-run browser matrix still holds (bootstrap code unchanged) |
| 3 | Post-login routing; sign out from the Account menu | PASS | local e2e passed: landings for every role, the "next from the cookie" case, sign out from the Account menu and the workspace sidebar |
| 4 | /signin matches UI.md "Sign in"; mobile single column; copy in COPY.md | PASS | Aurora Google button full width; loading "Opening Google…"; Google, link and config banners; axe 0 at 375 and 1280 on /signin, ?error=google, ?error=link (live) and ?error=config (e2e); scrollWidth equals viewport. New string "Sign-in isn't available right now. Try again in a few minutes." is in COPY.md |
| 5 | "Start for $99/mo" and "Log in" → real routes; /signin → /app/billing stub | PASS | preview `/` links `/signin` and `/signin?next=/app/billing`; local e2e "Start for $99/mo goes through sign-in to the billing paywall stub" passed |
| 6 | Signed-out /app, /team, /client → /signin (e2e) | PASS | e2e passed local and preview; curl 307s on preview |
| 7 | Google OFF on hosted: banner; stub flow works | PASS (expected gap) | preview: settings google=false, and the click shows "Google sign-in didn't finish. Try again, or use an email link." Stubbed Google e2e passed. Expected gap: real Google pending Jeun's OAuth client |
| 8 | Magic link works for real on the preview | PASS | Preview, real browser: the form POSTs /auth/next (204, cookie `rank1_next=/app/billing`, HttpOnly, Secure, SameSite=Lax, Path=/auth), then hosted POST /auth/v1/otp returns 200 for Resend's test sink delivered@resend.dev, and the form shows "Check your email. We sent a sign-in link to delivered@resend.dev." A fragment-only callback (`/auth/callback#access_token=…`) lands on /signin?error=link&next=%2Fapp%2Fbilling with the link banner. Bad token_hash and type=invite go to error=link. The link itself is proven by the local token_hash e2e: "a confirm-signup token_hash link signs a new user in", "the email link opened in another browser still lands on next, from the cookie the form set", "an expired email link comes back to /signin with the link banner" |

### Extra checks

| Check | Result | Evidence |
|---|---|---|
| No Supabase env: public 200, protected redirect | PASS | sandbox no-env build: /, /contact, /signin 200; /app, /team, /client 307 to /signin?next=. /auth/callback and POST /auth/signout now 307/303 to /signin?error=config (were an empty 500), and that page shows the config banner |
| Role gates, every role × area | PASS | area-gate unit tests and auth.spec.ts role cases passed; gate code unchanged since the first-run browser matrix |
| Same-origin only | PASS | preview POST /auth/signout and POST /auth/next: cross-site, same-site, foreign Origin and no headers are all 403; same-origin 303 / 204. GET /auth/signout 405. An unsafe next (`//evil.com`) clears the cookie (Max-Age=0) |
| axe at 375 and 1280 | PASS | see item 4; e2e axe checks passed local and preview |
| No secrets in .next/static | PASS | 28 files: the local service-role value is absent; no server-only env name; no secret patterns |
| "Visuals for <sha>" comment matches the head | PASS | newest PR #14 comment is "Visuals for 61ace35", and the head is 61ace35 |
| Changed tests since d7a54b0 | PASS | nothing loosened. The dropped `?code=…&via=email` case matches the new design (email links use token_hash). Callback, sign-in form, next-cookie and sign-out tests got stricter. type=invite is now rejected on purpose |

Not blocking:
- A wrong-role page answers 200 and redirects in the stream (AreaGate is inside Suspense). No protected content is sent.
- A self-serve owner with no business can open /app directly. Post-login routing still sends them to /app/onboarding.

### Blocking problems

None.

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
