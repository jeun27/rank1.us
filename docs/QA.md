# QA

## v3 restyle: Supabase-style dark (Design v3)

Checked 2026-11-06 on main at 3258a85:
- #92 (f3ff6c3): v3 tokens and themes
- #93 (7519529): v3 app shell for /app
- #95 (9eff317): ThemeSync sets the theme before paint
- #96 (ed487ec): v3 /team shell
- #97 (e4ea88e): v3 landing
- #98 (0c0b45b): v3 component drift

The UI checks and full e2e ran from the Mac against #99's final head preview at 1aa6078, whose tree is identical to 3258a85. Unit, typecheck, lint, format and build ran in the sandbox. test-db and the local-stack e2e come from CI on main's push of 3258a85 (run 42169754045). Example data only. This is the state v0.6.0 ships. The later "template portal" look is not part of this check.
Preview: https://rank1-nhq6n2w6i-bryan-flowhighlevels-projects.vercel.app (sha 1aa6078, READY).
Sources: docs/design/v3.md (approved 2026-11-06), UI.md v3, COPY.md.

Result: PASS after the re-check on 2026-11-06. V1b (no theme toggle on /client) failed the first run under a lead waiver for v0.6.0 and is FIXED by #109 (81b24e7). The first run's no-flash evidence was vacuous and is replaced below (re-measured on #109's preview, still no flash).

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, 3258a85) | PASS. 118 files, 1348 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push 3258a85 | PASS. test-db 24 files / 444 tests; e2e 573 passed, 13 skipped; test, typecheck, lint, format green |
| `E2E_BASE_URL=<preview> pnpm exec playwright test` (Mac, 1aa6078) | 503 passed, 81 skipped, 2 failed. Both failures are flaky (N1): a re-run of those two with `--repeat-each=3` gave 11 of 12 passing |
| `.next/static` scan for service role, Resend, Stripe, webhook and CRON secrets | PASS. No matches |

### Checks

The sweep covered 5 public pages (/, /signin, /privacy, /terms, /contact) and 14 themed pages (/dev/app dashboard, competitors, fixes, report, billing, switcher and all 6 experiments states, plus /dev/team and /dev/client). Each ran at 375 and 1280 with a saved "dark" and a saved "light" choice: 76 page loads.

| Check | Result | Evidence |
|---|---|---|
| Dark by default | PASS | Root layout server-renders `data-theme="dark"`. src/lib/theme.ts `themeFor`: public → dark; themed paths → saved, else prefers-color-scheme, else dark. e2e theme.spec "first visit with prefers-color-scheme: light → light /app pages; dark → dark" |
| V1: light toggle on /app and /team, never on public pages | PASS | The "Dark theme" toggle is present on every /dev/app state and /dev/team, and absent on all 5 public pages and /dev/client, at both widths and in both themes. Rendered only by src/app/app/layout.tsx and Workspace.tsx (plus the /dev gallery) |
| V1b: light toggle on /client (UI.md:8: "/app, /client and /team add a light theme, toggled by 'Dark theme'"; D40 = O2) | FAIL on the first run (waived for v0.6.0), FIXED by #109 | First run: /dev/client had no "Dark theme" toggle. My first run also wrongly counted that as correct: design/v3.md's approval line names /app and /team only, but UI.md:8 includes /client. Re-check table below |
| Public pages forced dark | PASS | With a saved "light" choice, all 5 public pages render `data-theme=dark` at 375 and 1280. e2e "public pages are always dark, even with a light system and a saved light choice" |
| Rail stays dark in light | PASS | AppShell.tsx:55 and Workspace.tsx:119 set `data-theme="dark"` on the rail subtree. globals.css re-declares the dark tokens for that scope (D14) |
| No theme flash on load | PASS (re-measured) | **The first run's evidence was vacuous.** Its init script attached a MutationObserver to `document.documentElement` before that element existed, so the observer threw and recorded nothing. "Only the expected value seen" was true of an empty list, so it proved nothing. Re-measured on #109's previews (4dc0384 and af282cb) with an observer on `document`, recording `data-theme` at the moment `<body>` is first inserted (before first paint) and every later value: /, /signin, /dev/client, /dev/app (dashboard-success, experiments-success) and /dev/team, at 375 and 1280, with saved light, dark and none, and system light and dark = 72 loads per preview. Every load had the expected theme at `<body>` (public pages dark) and never changed (`atBody` is set on every load, so this time the check is not empty). The theme script is inline in the server `<head>` (e2e "the theme script is in the server HTML head, before the body") |
| No flash on client navigation | PASS | ThemeSync applies `themeFor` in a layout effect on every path change. e2e "a saved light theme never leaks onto public pages through client-side links", "light on /app → … → the landing is dark → back to /app is light" and the /client variant all passed on the preview |
| AA contrast, both themes | PASS | axe (including color-contrast) found 0 violations on all 76 loads. e2e runs axe on every gallery state in dark and light |
| 44px targets below md | PASS | Sweep at 375 of every visible link, button, input, select, tab, option and summary: none under 44px on any themed page, the landing, /signin or /contact. Only exception: the inline "Contact us" text link inside the /privacy and /terms prose is 20px tall (N3, inline-text exception). e2e "tap targets are at least 44px on every page" |
| Breadcrumb one line at 375 | PASS | `nav[aria-label="Breadcrumb"]` is 44px tall (one row) on every /dev/app state and /dev/team at 375, with no side scroll (scrollWidth = 375). At 1280 it is 19px (32px with the switcher). e2e v3-drift "C5 … the /app breadcrumb is one line, the business crumb ellipsizes" and "a long business name ends in an ellipsis at 375" |
| No-JS client form | PASS (known limit, N2) | With JS off, the /team client switcher is in the server HTML as `<form method="get" action=/dev/team>` with `<select name="b">` and a "Show" submit (`.nojs-only`, shown when `html` lacks `.js`). As in Step 11, the streamed page sits in React's hidden streaming container until JS runs. The landing audit form is visible with JS off (email, domain, website; submit visible). Not submitted (no real lead) |
| No copy changes | PASS | `git diff ae49509 3258a85` on every src copy.ts: additions only, all Step 17 strings. COPY.md: 4 rows changed, all visual-term wording only ("Disabled pill" → "Disabled button", "brick"/"moss" → "error"/"success"). Every string is the same. Removed JSX strings ("Get my free audit", "Example data") were moved, not dropped |
| Landing demo n caption | PASS | Final state (reduced motion), live: "named in 34% of 160 answers, +6 pts". n is shown with the %. landing.spec "the landing renders and the demo is in its final state" (JS off) |
| Fonts and tokens | PASS | Body font is Inter on every page. JetBrains Mono for numbers (e2e "v3 fonts"). No Fraunces, Public Sans, #F7F4EE or beige in src. Light theme = #F6F7F9 cool grey |

### Blocking problems

None.

| Item | Result | Evidence |
|---|---|---|
| V1b: no theme toggle on /client | FAIL on the first run, waived by the lead for v0.6.0 (already live, cosmetic). FIXED by #109 (81b24e7) | Re-check table below |

### Re-check: #109 (fix(client): theme toggle in the /client header), 2026-11-06

Previews of #109: 4dc0384 (https://rank1-r0l7h6ryl-bryan-flowhighlevels-projects.vercel.app) and, after main's portal look (#104), af282cb (https://rank1-iwoeuap1z-bryan-flowhighlevels-projects.vercel.app). Both READY, with the same results. Later heads only merged main or moved the progress note, and #109's own diff stayed the same 7 src/test files. CI on the final head 3ec170c: all 9 checks green. Merged as 81b24e7.

| Check | Result | Evidence |
|---|---|---|
| V1b: "Dark theme" toggle in the /client header at 375 and 1280 | PASS | One button in the banner, 44x44, at both widths (src/components/auth/AppHeader.tsx renders ThemeToggle; used by src/app/client/layout.tsx and /dev/client) |
| aria-pressed and toggling | PASS | aria-pressed true on dark, false on light, and it flips on click. dark→light (system dark) and light→dark (system light) |
| Saved and shared with /app and /team | PASS | Toggling writes `rank1.workspace` `{theme}`. Afterwards /dev/client, /dev/app and /dev/team all load in the chosen theme, and the landing stays dark |
| No flash | PASS | See the re-measured "No theme flash on load" row above (72 loads, including /dev/client) |
| axe, both themes | PASS | 0 violations on /dev/client before and after toggling, at 375 and 1280. No side scroll |
| Tests | PASS | e2e client-theme.spec.ts "the /client header toggles the theme, saves it, and the saved choice wins before paint"; unit app-header-theme.test.tsx |
| N1: the two flaky specs | FIXED by #109 | experiments.spec.ts:40 waits for the first cell. landing.spec.ts:369 holds the IntersectionObserver and uses the page clock. `--repeat-each=5` on the preview (client-theme, experiments:40, landing:369, mobile + desktop): 30 of 30 passed |
| Full preview e2e (4dc0384) | 548 passed, 81 skipped, 2 failed (not from #109) | Both failures are connections.spec.ts:87 "ENABLE_CONNECTIONS off: … a real 404" (mobile + desktop). It skips on the runner's `ENABLE_CONNECTIONS`, but the Preview deployment has the flag on. A preview-aware skip is filed with frontend (from #100, non-blocking) |

### Non-blocking notes

- N1 (FIXED by #109, see the re-check): two preview e2e tests were flaky. tests/e2e/experiments.spec.ts:40 reads `card.getByRole("cell").allTextContents()` without waiting for the streamed card (got 0 cells, 1 failure in 4 preview runs). tests/e2e/landing.spec.ts:369 can see the demo already "final" before it asserts "running" (1 failure in 4). Both pass in CI. A fix for the first: wait for the first cell (`await expect(card.getByRole("cell").first()).toBeVisible()`) before reading.
- N2: with JS off, streamed pages (/dev/app, /dev/team, and the signed-in /app and /team) stay hidden until JS runs. This is the existing Step 11 note, not new in v3. The no-JS switcher form is present in the HTML.
- N3: the inline "Contact us" link in the /privacy and /terms body text is 20px tall at 375. Inline links in a sentence are exempt from the target-size rule.

## Step 17: Before/after test vs control (experiments)

Checked 2026-11-06 on main at 3258a85:
- #82 (12983e6): experiments db (migration 0020)
- #81 (ee17282): before/after vs control metrics
- #99 (3258a85): /app/experiments

The hosted DB has 0020 and 0022 (lead). The UI checks and full e2e ran from the Mac against #99's final head preview at 1aa6078, whose tree is identical to 3258a85. test-db (tests/db/experiments.test.ts) and the local-stack e2e (the dfy_client 404) come from CI on main's push of 3258a85 (run 42169754045). Example data only. QA has no signed-in preview session (the Step 16 N2 blocker), so the live create, end and delete flow comes from CI.
Preview: https://rank1-nhq6n2w6i-bryan-flowhighlevels-projects.vercel.app (sha 1aa6078, READY).
Sources: the lead's brief (rank1-step17.md), UI.md 4b "Experiments", COPY.md "Experiments (lead, 2026-11-05)".

Result: PASS. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, 3258a85) | PASS. 118 files, 1348 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push 3258a85 | PASS. test-db 444 tests (tests/db/experiments.test.ts: 26); e2e 573 passed, 13 skipped |
| Preview e2e (Mac, 1aa6078) | 503 passed, 2 flaky failures (v3 section N1), including experiments.spec.ts:40, which passed 5 of 6 re-runs |

### Checks

| Check | Result | Evidence |
|---|---|---|
| Role gate: dfy_client gets a 404, and RLS refuses | PASS | src/lib/supabase/middleware.ts `experimentsTarget` (normalized path, /app/experiments and /new only) → `my_landing() = 'dfy_client'` → 404. A dfy_client never reaches the /app shell or its nav (AreaGate sends them to /client). db "a dfy_client never sees, creates, ends or deletes experiments", "an outsider, and the team on a self-serve business, are refused", "nobody updates experiments or experiment_questions directly". e2e (CI) "a dfy_client gets a real 404 on /app/experiments and /app/experiments/new", "a self-serve user is not 404'd" |
| Who may write | PASS | db "self-serve members create, list, end and delete experiments", "the team creates, reads, ends and deletes on a DFY business" |
| Group rules | PASS | db refuses (22023): no test questions, an empty control group, a question in both groups, a test or control question from another business, a future change date, a non-http link (`javascript:`), a fix from another business, a blank name with no fix. "an experiment without both groups is refused at commit (23514)", "a question from another business can't join an experiment (23514)". UI "a question is in one group only: ticking it in Test unticks it in Control, and back" |
| Defaults | PASS | db "control defaults to the other active questions; date to LA today; name to the fix title", "refuses when there is no other active question for the default control". UI "the change date defaults to today (LA); control starts as every question", "from a fix: the name defaults to the fix title and fix_id is sent" |
| 28-day windows | PASS | `experiment_data` (0020): before = [d−28, d), after = [d, min(d+28, ended day+1)), keyed on the run's LA start date. Only ok answers in audit and weekly runs of the business count. experiment.ts `experimentWindows` = D−28..D−1 and D..D+27. db "counts ok answers of audit/weekly runs in [d-28, d) and [d, d+28)", "puts a run one minute before LA midnight on d in before, and midnight in after", "an ended test's after window stops at the end day (included)", "a deleted question drops out of its group and the counts" |
| Floored points and the difference | PASS | `computeExperiment`: change = floorPct(after) − floorPct(before), difference = test change − control change. Unit "floors each percent before subtracting, so the change matches the two shown percents", "each group gets before/after Metrics with n, the change in whole points, and the difference". UI "Change and Difference are signed floored points", "a negative change uses a minus sign; zero has no sign" |
| tooFew when n < 10 | PASS | `TOO_FEW = 10`. Any of the 4 cells under 10 → tooFew, change and difference null. UI "too few answers (any cell n < 10): the partial copy instead of numbers". Preview experiments-partial shows "Too few answers to call yet. Next check Monday." |
| No p-values or significance language | PASS | `grep -rniE "p-value|significan|confidence|statistically" src` finds only the code comment "No p-values here or anywhere". None in rendered text on any experiments state at 375 or 1280 in either theme. The e2e success test asserts the body has no p-value, signific or confiden. "Directional" is always the label (`EXPERIMENT_LABEL`) |
| Status | PASS | `experimentStatus`: running through D+27 (LA), done from D+28, and 'ended' always wins. db "status is done once LA today is 28 days after the change date". UI "status tags: Running / Done / Ended", "End test shows only while running and ends it", "Delete test asks first ('Delete this test? Its results go too.')" |
| Fix list button | PASS | FixList.tsx: "Start a before/after test" → `/app/experiments/new?fix=<id>`, shown only with canWrite. UI "each fix links to the form with its id, only with canWrite". e2e "Fix list: 'Start a before/after test' links to the form for that fix" (preview, passed) |
| UI.md 4b states | PASS | Preview, 375 and 1280, dark and light: experiments-empty, -loading, -error, -partial, -success and -form all have axe 0, one H1, no side scroll, every target ≥ 44px at 375, and the one-line breadcrumb. e2e "/dev/app experiments-{state} ({theme}): one H1, axe clean, no side scroll" (all states, both themes), "success: each card has Before / After as '% · n=', signed points, a Difference and 'Directional'" (phones: percent over n, stacked), "form by keyboard: the rules show inline errors, one group per question" |
| COPY.md strings | PASS | src/components/experiments/copy.ts matches COPY.md "Experiments (lead, 2026-11-05)" and the UI.md 4b row. Unit "COPY.md has 'Experiments (lead, 2026-11-05)' with the brief's and the approved strings". Nav "Experiments" |
| Migration rollback | PASS | CI test-db tests/db/migrations.test.ts (3 tests) passed on 3258a85, including "rollbacks undo everything in reverse order, and the migrations re-apply after" (rollbacks/…0020_experiments.down.sql) |

### Blocking problems

None.

### Non-blocking notes

- N1: tests/e2e/experiments.spec.ts:40 is flaky on the preview (reads the cells without waiting). See the v3 section N1.
- N2: the live signed-in create, end and delete on the hosted DB is still open. It needs a signed-in owner, so it joins the morning run with #78 and Step 16 N2.

## Step 16: White-label monthly report

Checked 2026-11-06 on main at 386f89f:
- #76 (87809bf): monthly reports, storage and report settings (migration 0019)
- #77 (b115f1f): white-label PDF and monthly send
- #85 (3ad1a3b): report preview export
- #86 (386f89f): /app/report page with settings, preview and history

The lead applied 0019–0021 to the hosted DB before this run. The sandbox Docker disk is full, so test-db and the local-stack e2e (report-db.spec.ts) come from CI on main's push of 386f89f (run 42145033429). Unit, typecheck, lint, format and build ran locally in the sandbox. The UI checks and full e2e ran from the Mac against #86's preview at bd79ddf, whose tree is identical to 386f89f. Example data only. Per the lead, "Send test to me" was NOT clicked live: the QA account's example.test address can't receive mail. The send path is verified by unit tests.
Preview: https://rank1-dspeuazo1-bryan-flowhighlevels-projects.vercel.app (sha bd79ddf, READY).
Sources: the lead's brief (rank1-step16.md), UI.md 4b "Report", COPY.md "Report (lead, 2026-11-05)".

Result: PASS after the re-check on 2026-11-06 (main 9361dda, #91). The first run failed on F1 (GA4 partial state missing). #91 fixed F1 and N1. N2 stays open with #78 for the morning signed-in run.

### Re-check: #91 (fix(app): report GA4 partial state), main 9361dda

#91's preview at 7046a0a (tree identical to 9361dda): https://rank1-2zjzmz9xi-bryan-flowhighlevels-projects.vercel.app (READY).

| Check | Result | Evidence |
|---|---|---|
| CI on main push 9361dda | PASS | test, typecheck, lint, format, test-db, e2e green |
| Report unit tests (sandbox, 9361dda) | PASS | `vitest run tests/unit/report tests/unit/reports`: 7 files, 67 tests passed. ga4-link.test: "is /app/settings/connections when ENABLE_CONNECTIONS is 'true'"; null for unset, "", "false", "1", "TRUE" |
| F1: 'Connect GA4' only when ENABLE_CONNECTIONS="true", to /app/settings/connections; GA4 section hidden | PASS | src/app/app/report/ga4.ts `ga4ConnectHref` uses `connectionsEnabled()` (`=== "true"`). /app/report passes it to ReportView, which renders the link only when it's set. No GA4 section anywhere. Preview /dev/app?state=report-partial at 375 and 1280: one "Connect GA4" link, href /app/settings/connections, 44 px tall, axe 0, no side scroll, no GA4 heading. report-success and report-empty: no link. e2e "report-partial: 'Connect GA4' links to the Connections hub" plus the 4b state loop. COPY.md row "GA4 not connected (partial)" added |
| F1: prod shows no link | PASS | `vercel env ls`: ENABLE_CONNECTIONS is set for Preview only, not Production, so `ga4ConnectHref()` is null in prod |
| N1: 404s carry no-store | PASS | preview.pdf (no business, no PDF) and download 404s now send `Cache-Control: no-store`. report-db e2e (local stack, CI) asserts the download 404's `cache-control` contains no-store |


### Commands

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm test` (sandbox, 386f89f) | PASS. 107 files, 1263 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push 386f89f | PASS. test-db 24 files / 438 tests (tests/db/reports.test.ts 16 tests); e2e 366 passed, 2 skipped; test, typecheck, lint, format green |
| `E2E_BASE_URL=<preview> pnpm exec playwright test` (Mac, bd79ddf) | PASS. 303 passed, 65 skipped (local-stack specs), 0 failed |
| `.next/static` scan for service role, Resend, Stripe, CRON_SECRET | PASS. No matches |

### Checks

| Check | Result | Evidence |
|---|---|---|
| White-label PDF: no "Rank1", "Powered by", Jelly or product logo | PASS | Unit "the rendered PDF has the business and the lead's headings, and no product name or credit" (text extracted from the rendered PDF, with a control check that the business name is found) and "the PDF code and copy have no product name either". Live: the preview's /dev/report-preview.pdf (real renderer, Example data) is 200 application/pdf, `%PDF-`, no-store. The extracted text has "Example Ramen House", all six COPY.md headings and "API-measured, directional", and no rank1/rank 1/powered by/jelly |
| White-label email: From = business name at REPORT_FROM_EMAIL; COPY.md subject and body | PASS | src/lib/reports/email.ts. Unit "the email: From = the business name at REPORT_FROM_EMAIL, the lead's subject and body, the PDF attached, no product name"; "a business name can't break the From header" (strips < > " and line breaks). No send while REPORT_FROM_EMAIL is unset |
| Send test to me: the signed-in user only | PASS (unit) | src/lib/reports/service.ts `sendTestReport`: `to = [auth.user.email]` from `db.auth.getUser()`; the action takes no address input. Unit "sends last month's report to the signed-in user's own email only, never the recipients"; signed out or an RLS-hidden business → not_allowed, nothing sent; a Resend error or missing REPORT_FROM_EMAIL → failed. Not clicked live (lead's A10 change) |
| Idempotency: monthly send key = report id | PASS | process.ts passes `report.report_id`; email.ts sets `idempotency-key`. Unit "renders, stores, sends with the report id as the idempotency key"; "a failed send is not marked sent; it retries (Resend dedupes by the report id)". Test sends use a per-user, per-minute key |
| Recipients: ≤ 10 valid emails; none → stored, nothing sent | PASS | Action validates, trims, lowercases, dedupes; DB `set_report_settings` enforces it again (db "rejects a bad color, more than 10 recipients, or an invalid email (23514)"). Unit "no recipients → generated and stored, nothing sent"; UI test "more than 10 or a bad email is refused" |
| Storage: private buckets, signed URLs, no-store | PASS | db "reports and logos are private, with size and type limits"; "signed-in users and anon cannot read or write either bucket directly"; "members list reports and get a signed download URL; strangers get nothing". 60 s signed URLs. Download route 302 with `Cache-Control: no-store`, 404 when RLS hides the row; preview.pdf `no-store`. Signed out on the preview: /app/report, /app/report/preview.pdf and /app/report/{id}/download → 307 /signin |
| Logo: PNG/JPEG ≤ 512 KB, SVG rejected | PASS | src/lib/queries/reports.ts `uploadLogo` checks magic bytes (PNG, JPEG), size, and `can_write_business`. db "refuses SVG and other types, files over 512 KB, and callers who can't change the business"; "logo_path is server-only and must stay under the business id" |
| Brand color: accent only, falls back to ink below AA | PASS | contrast.ts `accentColor` (4.5:1 on white, else ink). Unit "keeps a brand color with AA contrast on white, else falls back to ink" |
| Stored data only, counts-only logs | PASS | Unit "stored data only: n on every %…", "a month with no run: no numbers invented", "forbidden fields never reach the data", "logs carry counts and codes only: no business name, email, id or error text" |
| DFY fix list | PASS | Unit fix-visibility: hidden → no fixes heading or text in the PDF or email; visible → shown; self-serve always shown. db "the team reads DFY reports but not self-serve ones; a dfy_client reads its own"; "a dfy_client can't change report settings" |
| DB: enqueue eligibility, idempotency, claims, finish, service-only | PASS | db "queues last month's report for paid, trialing and DFY businesses only; idempotent", "rejects any month but the previous LA month (22023), and non-service callers (42501)", "claims are exclusive under parallel calls", "re-claims a stale report and fails it after 3 attempts", "finishes generated, sent and failed reports once…", "members can't insert, update or delete reports" |
| Migrations 0019–0021 roll back and re-apply | PASS | CI test-db "rollbacks undo everything in reverse order, and the migrations re-apply" (rollbacks/*0019, 0020, 0021 .down.sql) |
| Cron schedule, LA window, 401 | PASS | vercel.json /api/cron/monthly-report "0 14,15 1 * *" (pinned by vercel-config.test). month.ts `isMonthlyWindow` = LA day 1, hour 7. Unit "exactly one of the two fires (14:00, 15:00 UTC on the 1st) matches, every month of 2026"; route: wrong/missing/lowercase bearer → 401; "the other UTC fire (06:05 PST) is a no-op without touching the DB". Preview: no header → 401 `{"error":"unauthorized"}` |
| Drain: ≤ 2 per tick; 500 bodies carry no DB text | PASS | process.ts REPORTS_PER_TICK = 2, one claim at a time, ≥ 60 s left. Unit "at most 2 per tick, claimed one at a time", "never claims with under 60 s left". Monthly route "enqueue fails → 500 with a fixed label and no DB error text" (`{"error":"enqueue_failed"}`) |
| UI.md 4b empty | PASS | Preview /dev/app?state=report-empty, 375 and 1280: "Your first report sends on the 1st." + "Report preview" iframe; axe 0; one H1; no side scroll |
| UI.md 4b loading | PASS | report-loading: skeleton, axe 0, one H1, no side scroll |
| UI.md 4b error | PASS | report-failed: "The report didn't send to {email}. Check the address." and status "Failed"; axe 0 |
| UI.md 4b success | PASS | report-success: Logo, Upload logo, Brand color, Recipients (hint), Save, Send test to me, History with Month / Status / Download, statuses Sent / Ready; axe 0. e2e "keyboard reaches the settings, the test send and every download" |
| UI.md 4b partial: GA4 not connected → section hidden + 'Connect GA4' link to /app/settings | FAIL (F1) on the first run, FIXED by #91 | No "Connect GA4" link in any report state at 375 or 1280 (`getByRole("link", { name: /connect ga4/i })` = 0). No GA4 reference in src/components/report, src/lib/reports or src/app/app/report, no gallery state, no test |
| UI.md 4b mobile: preview scales to width | PASS | Preview iframe 335 px wide at 375, 1056 px at 1280, aspect 1:1.414; scrollWidth = viewport. e2e "the preview scales to the width" (both projects) |
| History downloads | PASS (CI) | Local-stack e2e report-db.spec "owner saves recipients and a color, they persist; a history download redirects to a signed URL" passed in CI. Not live: no stored report exists on the hosted DB until the 1st, and QA has no signed-in preview session (same blocker as Step 14) |
| Nav "Reports" and COPY.md strings | PASS | AppNav.tsx `{ href: "/app/report", label: "Reports" }`. src/components/report/copy.ts matches COPY.md "/app/report (Step 16 frontend)"; UI test "COPY.md has the lead's Report strings". The brief's suggested "Download PDF" / "Report history" became "Download" / "History" in the lead's COPY.md, which is the source of truth |

### Blocking problems

None.

First-run blockers (386f89f):

| Blocker | Result | Evidence |
|---|---|---|
| F1: UI.md 4b partial not built: no GA4 "not connected" state or 'Connect GA4' link on /app/report (brief lines 11 and 17) | FIXED by #91 (9361dda) | re-check table above. Lead decision 2026-11-06: the link shows only when ENABLE_CONNECTIONS="true" and goes to /app/settings/connections; prod (flag off) shows no link and no GA4 section |
| N1 (non-blocking): 404s from /app/report/preview.pdf and /app/report/{id}/download had no `Cache-Control: no-store` | FIXED by #91 (9361dda) | re-check table above |

### Non-blocking notes

- N2: a live signed-in Preview and history download on the hosted DB is still open. It needs a signed-in owner (founder's morning session) and a stored report.

## Step 13: Weekly cron

Checked 2026-11-05 on main at 9f696c3:
- #68 (64d0212): weekly run enqueue and cache pruning
- #69 (9f696c3): weekly cron route

The sandbox Docker disk is full, so there was no local Supabase. test-db and e2e come from CI on main's push of 9f696c3 (run 42111709487). Unit, typecheck, lint and format ran locally in the sandbox. The 401 checks ran from the Mac on #69's preview at 08509f8, whose tree is identical to 9f696c3. No live paid calls. I don't have CRON_SECRET, so the in-window and outside-window paths come from unit tests.
Preview: https://rank1-f16z2r9t8-bryan-flowhighlevels-projects.vercel.app (sha 08509f8, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §6 Step 13, the lead's brief (rank1-step13.md).

Result: PASS. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, 9f696c3) | PASS. 81 files, 978 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` (sandbox) | PASS |
| CI on main push 9f696c3 | PASS. test-db 18 files / 347 tests; e2e 320 passed, 2 skipped; test, typecheck, lint, format green |

### Checks

| Check | Result | Evidence |
|---|---|---|
| vercel.json: /api/cron/weekly at "0 13,14 * * 1" plus run-jobs | PASS | vercel.json crons = run-jobs "* * * * *" and weekly "0 13,14 * * 1"; pinned by tests/unit/vercel-config.test.ts |
| Window: Monday 06:xx America/Los_Angeles only, across both 2026 DST switches, exactly one fire per Monday | PASS | src/lib/runs/weekly.ts `isWeeklyWindow` (Intl, America/Los_Angeles, Monday + hour 6). tests/unit/runs/weekly.test.ts covers: PST before Mar 8 (14:00 UTC yes, 13:00 no); PDT after (13:00 yes, 14:00 no); Oct 26 PDT; Nov 2 PST after the Nov 1 switch; 06:59:59 yes, 05:59:59 and 07:00 no; Sunday and Tuesday no. "exactly one of the two Monday fires (13:00, 14:00 UTC) matches, every Monday of 2026". laWeekStart is the same LA Monday for both fires |
| GET /api/cron/weekly: missing/wrong bearer → 401 | PASS | preview: no header, "Bearer wrong", "bearer x", "Bearer " → 401 `{"error":"unauthorized"}` on /api/cron/weekly and /api/cron/run-jobs. Unit weekly-route.test: undefined, "", wrong, lowercase bearer, bare secret, secret + x → 401; 401 for everyone while CRON_SECRET is unset |
| Correct request outside the window → no-op | PASS (unit) | weekly-route.test "the other Monday fire (13:00 UTC in PST) is a no-op: no DB client at all"; weekly.test "outside the window: a no-op, no DB call". The response is 200 `{skipped: "outside_window"}` |
| enqueue_weekly_runs: eligibility, idempotency (incl. concurrent), open-run skip, current-week guard | PASS | CI db weekly.test.ts: "enqueues paid, trialing and DFY businesses; never unpaid, past_due, archived or question-less ones", "is idempotent within the week: a second call adds nothing, even after the first run finished", "a weekly run from an earlier week doesn't block this week's", "skips a business with an open run", "two concurrent calls for the same week make exactly one run per business", "rejects a week start that isn't the current LA week's Monday (22023)" |
| prune_ephemeral boundaries | PASS | db "deletes lookup_cache rows over 24 h and rate_events over 48 h, keeping newer ones" |
| Service-only (42501) | PASS | db "members and anon get 42501 on both functions" |
| Constant-time CRON_SECRET on both crons | PASS | src/lib/runs/drain.ts `cronAuthorized`: refuses an unset/blank secret or a missing header, then `timingSafeEqual` on SHA-256 digests of the header and `Bearer ${secret}` (equal length, so no length leak). Both routes import it. Fixes the Step 6 QA note |
| 500 bodies carry no DB text | PASS | weekly → `{"error":"enqueue_failed"}` / `{"error":"prune_failed"}`; run-jobs → `{"error":"claim_failed"}`; logs carry Postgres codes and counts only. Unit "enqueue error → prune still runs → 500 with no DB text; the log has codes only", "prune error → 500 prune_failed, no DB text", run-jobs "claim_jobs failing → 500 with a fixed label and no DB error text". Fixes the Step 6 QA note |
| Weekly route only enqueues, logs counts only | PASS | route calls enqueue + prune only (no engine call); log line "weekly {week}: enqueued= skipped= failed= pruned lookup_cache= rate_events="; unit "logs counts only" |

### Blocking problems

None.

## Step 12: Client invites + DFY client dashboard

Checked 2026-11-05 on main at 092636f:
- #61 (35e1023): client invites and fix list visibility
- #63 (092636f): DFY client dashboard and invites

The sandbox Docker disk is full, so there was no local Supabase. test-db and e2e come from CI on main's push of 092636f (run 42095822788); the CI e2e stubs the admin invite, so I sent no invite emails. Unit, typecheck, lint, format and build ran locally in the sandbox. UI checks ran from the Mac on #63's preview at 8c5cf6a, whose app code is identical to 092636f (only PROGRESS.md differs).
Preview: https://rank1-mqeak2e3m-bryan-flowhighlevels-projects.vercel.app (sha 8c5cf6a, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §3/§6 Step 12, the lead's brief (rank1-step12.md).

Result: PASS. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, 092636f) | PASS. 78 files, 943 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push 092636f | PASS. test-db 17 files / 339 tests; e2e 320 passed, 2 skipped; test, typecheck, lint, format green |
| `E2E_BASE_URL=<preview> pnpm e2e` (092636f tests) | PASS. 263 passed, 59 skipped (local-stack tests), 0 failed |

### Checks

| Check | Result | Evidence |
|---|---|---|
| New email → invited | PASS | CI db clients.test.ts "invites a new email: sends the invite with the callback URL and grants the client role + membership" |
| Already this business's client → "Already invited." | PASS | db "says 'already invited' for this business's client, without a second invite"; the string is in COPY.md "Client invites (lead, 2026-11-05)" |
| Any existing account → refused, nothing changed | PASS | db "refuses any existing account and changes nothing (self-serve, team, another business's client)"; client_invite_status and grant_dfy_client refuse other access ("This user already has other Rank1 access") |
| Grant failure deletes the created user; a retry works | PASS | src/lib/queries/clients.ts deletes the just-invited user when grant_dfy_client fails; db "a failed grant deletes the just-invited user and returns error, so a retry starts clean"; "a failed invite returns error and creates nothing" |
| Only the team can invite, remove access, toggle or list | PASS | client_invite_status, grant_dfy_client and revoke_dfy_client are service-role only and revoked from anon and authenticated; set_fix_list_visible and list_client_users check private.is_team_dfy_business. src/app/team/actions.ts `teamDfy` requires landing = team and a DFY business visible through RLS before any service-role call. db: "set_fix_list_visible toggles for team, and refuses self-serve, dfy_client and anon (42501)", listClientUsers 42501 for non-team callers and for a self-serve business, grant "refuses team users, other workspaces' members and self-serve businesses" |
| /auth/callback accepts type invite | PASS | src/app/auth/callback/route.ts EMAIL_TYPES = magiclink, signup, email, invite; unit callback.test "verifies a token_hash link of type invite"; CI e2e "invite link → /client; fixes only when shown; Remove access → Nothing tracked yet." |
| /client read-only: hero + n + Measured, 8-run line, engines, top 5, History; fix list only when fix_list_visible; no switcher, SoV, prices or write controls | PASS | preview /dev/client at 375 and 1280: H1 "Dashboard". With a run: "Checked … ago · n answers · API-measured, directional" and "named in a of n" on every number, History shown. "What to fix next" only in the fixes states, read-only (0 selects, 0 buttons). No share of voice, no $ amount and no email anywhere. Unit "fix list shown: the shared FixList, read-only"; e2e "read-only: no Status select, no competitor edits, no billing or prices" |
| Empty states | PASS | no run: "No weekly checks yet. Your first one runs Monday."; access removed: "Nothing tracked yet." with no button (0 buttons); unit "access removed: 'Nothing tracked yet.' and no button" |
| axe, no side scroll, keyboard | PASS | 0 violations and scrollWidth = viewport on success, fixes, partial, no-run, no-run-fixes and removed at 375 and 1280; e2e "/dev/client {state}: one H1, axe clean, no side scroll", "keyboard: every link and button on the client dashboard is reachable with Tab" |
| /team Clients tab: list, Invite client, Remove access, "Show fix list to client"; approved error strings | PASS | preview /dev/team at 375 and 1280: Clients tab, "Invite client" with "Send invite", "Remove access", the "Show fix list to client" checkbox; axe clean, no side scroll. Unit clients-panel.test: Remove calls the action for that user, invalid email and error banners, the toggle reverts on failure, "COPY.md has the lead's Client invites strings" |
| Client emails never on the client side or in logs | PASS | No email in /dev/client at either width; src/app/client and src/components/client never read an email. Emails come only from list_client_users (team only) in the team panel. clients.ts and the team actions log nothing and return status codes only ("never log or echo the email") |

Not blocking:
- If deleting the just-invited user also fails after a failed grant, the action returns "error" but the role-less account stays, and a retry for that email would then say "This email already has a Rank1 account." Rare (two Supabase Auth failures in a row).

### Blocking problems

None.

## Step 11: Team 3-pane shell + workspace + Copy context (re-run)

Checked 2026-11-05 on main at d9afd3b:
- #56 (a69cf31): team read access to DFY clients
- #55 (d8a6d7c): context brief from stored data
- #60 (d9afd3b): team workspace on real data

The sandbox Docker disk is full, so there was no local Supabase. test-db and e2e come from CI on main's push of d9afd3b (run 42087416215). Unit, typecheck, lint, format and build ran locally in the sandbox. Preview checks ran from the Mac on #60's preview at b90e927, whose tree is identical to d9afd3b. ENABLE_TEAM_WORKSPACE is set for Preview only. No live paid calls.
Preview: https://rank1-1od9nd4z1-bryan-flowhighlevels-projects.vercel.app (sha b90e927, READY). Production: rank1.us = rank1-ayffk0vj7 at b2cd487 (Step 9; Step 11 not released).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §3/§5.7/§6/§8 and the lead's brief (rank1-step11.md).

Result: PASS. The first run's blocker (preview e2e red because Vercel's preview toolbar loads from vercel.live) is fixed by #64 (merged as 076ec8b, test-only). No blocking problems.

Re-run 2026-11-05 on #64's preview at cae62a5, whose tree is identical to main 076ec8b: https://rank1-4liiyi2fo-bryan-flowhighlevels-projects.vercel.app

| Check | Result | Evidence |
|---|---|---|
| Preview e2e (076ec8b tests) | PASS | 239 passed, 57 skipped (local-stack tests), 0 failed. "the prompt template is added to the brief; nothing calls a model" passes on both viewports |
| The guard still fails on a non-allowed host | PASS | tests/e2e/team-workspace.spec.ts (076ec8b) asserts two lists are empty. First, hosts in MODEL_HOSTS (api.anthropic.com, api.openai.com, generativelanguage.googleapis.com, api.perplexity.ai). Second, hosts not in `allowed` = the page's own host, plus exactly "vercel.live" only when E2E_BASE_URL is set. Any other off-site request still fails the test, and a model host fails it even on a preview |
| CI on main push 076ec8b | PASS | run 42092923609: test, typecheck, lint, format, test-db, e2e green |

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, d9afd3b) | PASS. 76 files, 929 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push d9afd3b | PASS. test-db 16 files / 328 tests; e2e 294 passed, 2 skipped; test, typecheck, lint, format green |
| `E2E_BASE_URL=<preview> pnpm e2e` (first run, d9afd3b tests) | FAIL. 237 passed, 57 skipped, 2 failed: tests/e2e/team-workspace.spec.ts:117 "the prompt template is added to the brief; nothing calls a model" on both viewports. Received third-party host `vercel.live`. Every other team test passed, including /dev/team light and dark (3 landmarks, one H1, axe clean) at 375 and 1280 |

### Checks

| Check | Result | Evidence |
|---|---|---|
| Team-only access | PASS | /team is behind AreaGate (team role) and ENABLE_TEAM_WORKSPACE. Preview e2e "/app is not the team workspace (reserved for owners)" |
| Team sees DFY businesses only, never self-serve or free audits | PASS | CI db team.test.ts: "sees every covered table for both DFY businesses", "listDfyBusinesses lists every DFY business by name, not self-serve ones", "every query the team pages use returns the DFY data", "free audits stay invisible, even with a DFY business id", "gets nothing for a self-serve business on any covered table"; "a dfy_client sees only its own DFY business, and fixes only when visible"; "a self-serve user sees no DFY rows; anon is refused" |
| A non-member team user reads and writes DFY | PASS | CI db "a non-member team user sets fix status and adds/dismisses competitors on any DFY business"; "a team user can't write a self-serve business, and a dfy_client never writes". Team pages read through RLS (no createServiceClient in src/app/team or src/components/workspace) |
| Nav has only the 6 sections | PASS | Sidebar NAV_SECTIONS hides experiments, reports, settings. Preview /dev/team nav: Dashboard, Questions, Competitors, Sources, Fix list, History |
| Client switcher works without JS | PASS | ContextPane `ClientSwitcher` is `<form method="get">` with `<select name="b">` (2 clients) and a submit button, in the server HTML with JS off and on. Without JS /dev/team, like every /app page, sits in the hidden streaming template (the known non-blocking note) |
| Copy context = stored-data brief (n on every %, no why_note/raw/cost/emails/tokens) | PASS | unit context-markdown.test.ts: "every percentage carries its n; no bare 0% when nothing was answered", "never prints forbidden fields, even when the inputs carry them", "only stored texts", "is stable", the 12,000-char cap. Preview e2e "Copy context writes the dashboard brief Markdown" passed |
| Open in Claude opens exactly https://claude.ai after copying | PASS | ContextPane.tsx: `<a href={CLAUDE_URL} target="_blank" rel="noopener noreferrer" onClick={copy…}>`, CLAUDE_URL = "https://claude.ai" (no ?q=). Unit "is exactly https://claude.ai: no ?q= prefill and no data in the URL"; preview e2e "Open in Claude copies it and opens exactly claude.ai" passed on both viewports |
| Maps suggestions only in the Competitors view | PASS | team.tsx / Docs.tsx fetch `teamSuggestions` only when the Competitors view opens, through the 24 h cache and the caller's maps_lookup token. teamSuggestions resolves the business through listDfyBusinesses (RLS), so a non-team caller gets [] |
| Latest = an audit or weekly run | PASS | src/app/team/load.ts uses listRunSummaries(…, ["complete", "partial"]) (audit/weekly only, never free audits) and loadPaidRun; e2e "a DFY client with only an audit run shows its numbers" (CI) |
| No LLM SDK anywhere | PASS | no-llm-sdk.test.ts (package.json, src, control); my `git grep` at d9afd3b for openai, @anthropic-ai, @google/genai, @google/generative-ai, cohere-ai, @mistralai, langchain, ai imports: 0 matches |
| Production /team stays the placeholder | PASS (as far as reachable) | ENABLE_TEAM_WORKSPACE is set for target ['preview'] only (Vercel env API), so it's unset on Production, and unit gate.test.tsx shows the placeholder for every unset/false value. rank1.us/team signed out → 307 /signin?next=%2Fteam; rank1.us/dev/team → 404. A signed-in team check on production needs a hosted team login |

Not blocking:
- The Vercel preview toolbar (`vercel.live/_next-live/feedback/feedback.js`) is still injected into every preview page. The test now ignores exactly that host on deployed previews only. Production has no toolbar.

First-run blocker (d9afd3b):

| Blocker | Result | Evidence |
|---|---|---|
| Preview e2e: team-workspace.spec.ts:117 "nothing calls a model" failed on both viewports on the vercel.live toolbar request | FIXED by #64 (076ec8b), test-only | re-run table above |

### Blocking problems

None.

## Step 10: What to fix next (role-gated)

Checked 2026-11-05 on main at 11a5303:
- #50 (ebb004b): fix results and status
- #51 (59e2a42): site checks R10, R11, R14 and H1
- #53 (11a5303): what to fix next

The sandbox Docker disk is full, so there was no local Supabase. test-db and e2e come from CI on main's push of 11a5303 (run 42073956031). Unit, typecheck, lint, format and build ran locally in the sandbox, plus a local production build for the /dev/app gallery checks (the Mac was briefly offline). Preview e2e ran from the Mac on #53's preview at cf07774, whose tree is identical to 11a5303. No live paid calls, fixture sites only.
Preview: https://rank1-bvxxerqea-bryan-flowhighlevels-projects.vercel.app (sha cf07774, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §4/§6 Step 10, the lead's brief (rank1-step10.md), docs/SCHEMA.md §5b R10/R11/R14/H1, docs/UI.md 4b "Fix list" row.

Result: PASS. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, 11a5303) | PASS. 73 files, 909 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push 11a5303 | PASS. test-db 15 files / 318 tests; e2e 284 passed, 2 skipped; test, typecheck, lint, format green |
| `E2E_BASE_URL=<preview> pnpm e2e` (11a5303 tests) | PASS. 214 passed, 72 skipped (local-stack tests), 0 failed. /dev/app fixes-{success, partial, readonly, empty, loading, error}: one H1, axe clean, no side scroll at 375 and 1280 |

### Checks

| Check | Result | Evidence |
|---|---|---|
| Only R10, R11, R14 and H1 have detectors; A1–A6 seeded disabled; disabled rules never produce fixes | PASS | src/lib/fixes has r10-menu, r11-dishes, r14-robots and h1-schema only. Migration 0014 inserts A1–A6 with enabled=false and a PENDING placeholder (on conflict do nothing). record_fix_results refuses any rule that isn't enabled ("Unknown or disabled rule", 22023). cron.test "only rules enabled in fix_rules right now are evaluated and recorded" |
| Detection: fix / ok / unchecked per rule; filled copy matches SCHEMA exactly | PASS | src/lib/fixes/types.ts templates are SCHEMA §5b's customer copy, verbatim for R10, R11, R14 and H1 (my diff against SCHEMA.md, plus rules.test "templates are the SCHEMA.md §5b customer copy, verbatim"). rules.test covers: a good site ok on all four; no domain → all unchecked; unreachable site → unchecked; robots disallowing Rank1 → page rules unchecked; R10 ok, fix, menu_not_found, menu_ambiguous; R11 fix up to 5 dishes, ok via a heading or FAQ, no_html_menu; R14 missing robots → ok, unreachable → unchecked; H1 ok vs fix with the exact tidy-up copy |
| R14 fixes only for OAI-SearchBot / PerplexityBot | PASS | r14-robots.ts FIX_BOTS = OAI-SearchBot, PerplexityBot; INFO_BOTS = GPTBot, Google-Extended (info only); paths / and /menu. rules.test "GPTBot and Google-Extended blocks are info only, never a fix", "a search bot's own Allow group beats a * Disallow" |
| No paid calls; every request to the business host | PASS | rules.test "never calls a paid API: every request goes to the business host"; fetcher.test "refuses other hosts". It reuses readSite's guarded fetcher (SSRF guard, size cap, timeout, robots) |
| Budget: ≤ 23 requests / 45 s; 1 run per tick with ≥ 60 s left | PASS | evaluate.ts MAX_REQUESTS = 3 + 20 = 23, BUDGET_MS = 45 000; cron.ts MIN_TIME_LEFT_MS = 60 000, one run per tick. fetcher.test "stops at maxRequests (robots counts as one)", "stops once the time budget is spent"; R11 "crawls at most max_pages"; cron.test "skips with less than 60 s left" |
| Failures still record fix_checks | PASS | cron.test "an evaluate error records every enabled rule as unchecked", "a failing record retries once with every enabled rule unchecked 'error', no new crawl", "both records failing → error, logged without PII, never thrown". db "lists closed paid runs until recorded (all-unchecked counts as recorded)" |
| Role gate: team + self_serve read/write; dfy_client reads only with fix_list_visible, never writes; why_note never readable | PASS | CI db fixes.test.ts "self-serve members read and write", "team members read and write a dfy business's fix list while it is hidden from the client", "a dfy_client reads only when fix_list_visible is on, and never writes", "a non-member gets nothing", "why_note is never readable by signed-in users, and never in the fix list", "members cannot write fix_checks directly"; record_fix_results refuses signed-in users (42501) |
| Page: ranked by size (no size shown) | PASS | listFixes / openFixes sort with `bySize` (S → S-M → M → M-L → L, then rule key). db shell.test "returns open fixes ranked by size then rule key, never tidy-ups or why_note". Gallery at both widths: no size label shown |
| Tidy-ups only H1 | PASS | openFixes splits by the hygiene group (H1); unit "H1 only under Tidy-ups, never in the ranked list"; gallery shows a "Tidy-ups" section after the ranked list |
| "We couldn’t check this yet." rows; no-URL note; empty copy | PASS | gallery fixes-partial: 2 rows "We couldn’t check this yet." and the note "Listing and site checks need your website URL" once; fixes-empty: "Nothing to fix yet. Run your first check." (UI.md 4b) |
| Status control for writers only; error banner | PASS | gallery: 4 labelled Status selects on fixes-success, 0 on fixes-readonly; set_fix_status checks can_write_fixes. Unit "a failed status change shows the banner and puts the old value back"; fixes-error shows the 4b banner "We couldn't load your results. Try again." |
| No 'Start a before/after test' | PASS | absent from every fixes state; unit "empty: … no 'Start a before/after test' (Step 17)" |
| Measured n equals the Dashboard's | PASS | src/app/app/fixes/page.tsx uses `runMeasured(runs[0])` from loadShell's latest complete/partial run, the run the Dashboard uses. Its n is the run summary, proven equal to computeMetrics by the Step 8 parity test |
| Dashboard top 3 excludes H1 and links to /app/fixes | PASS | getTopFixes = openFixes().ranked (never tidy-ups); db "never tidy-ups or why_note, at most the limit"; dashboard-success has a link to /app/fixes; nav has "What to fix next" after Sources |
| No internal text | PASS | no why_note, PENDING, vendor names or data_source on any gallery state |

Not blocking (dev gallery only):
- /dev/app fixes states use invented "Example data: …" titles and details instead of the SCHEMA copy that detectors write, and list R10 (M-L), R11 (L), R14 (S) in that order rather than ranked by size. The real page shows detector text and sorts by size (tests above), so only the Visuals don't match production.
- The fixes gallery's Measured line uses a fixed `answers: 38`, while the Dashboard gallery shows 240. On the real pages both come from the same latest run.

### Blocking problems

None.

## Step 9: Source chart + location view (re-run)

Checked 2026-11-05 on main at b2cd487:
- #43 (4feb18b): sources fields
- #44 (3ac195d): per-engine sources and location view
- #45 (b2cd487): sources page with location view

The sandbox Docker disk is full, so there was no local Supabase. test-db and e2e come from CI on main's push of b2cd487 (run 42061672476). Unit, typecheck, lint, format and build ran locally in the sandbox. The UI checks ran from the Mac on #45's preview at 0fe54a3, whose tree is identical to b2cd487. No live paid calls, fake Example data only.
Preview: https://rank1-f4wuxktlf-bryan-flowhighlevels-projects.vercel.app (sha 0fe54a3, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §6 Step 9, the lead's brief (rank1-step9.md), docs/UI.md 4b "Sources" row and the engine × location table, AEO.md.

Result: PASS. The first run's blocker (the location selector needed JavaScript) is fixed by #52 (merged as 0016dc0). No blocking problems.

Re-run 2026-11-05 on #52's preview at ace6e22, whose tree is identical to main 0016dc0: https://rank1-qbnaw3ds9-bryan-flowhighlevels-projects.vercel.app

| Check | Result | Evidence |
|---|---|---|
| Selector is a GET form (JS off) | PASS | 375 and 1280 with JavaScript disabled, /dev/app?state=sources-form: the server HTML has `<form method="get">` with `<select name="location">` (All locations + 2 targets), a hidden state field and a "Show" submit button. src/components/app/LocationSelect.tsx is a plain form (no onChange navigation). The form sits in /dev/app's hidden streaming template without JS (the known non-blocking note) |
| Show submits and keeps the choice (JS on) | PASS | 375 and 1280: picking "City" and pressing Show loads ?state=sources-form&location=city:US\|CA\|Irvine with that option still selected. Show is 44 px tall. e2e "sources location form: Show submits ?location= and the choice is kept; All locations clears it" passed on both viewports |
| Filter result | PASS | All locations: 6 / 4 / 10 / 2 links; City or Country: 3 / 2 / 5 / 1 links; an unknown key (bogus:key): no links, "No links cited by …". The real /app/sources computes the measured n from the filtered ok answers (src/app/app/sources/page.tsx). The gallery's fixed `answers: 38` is dev-only |
| axe, no side scroll | PASS | 0 violations at 375 and 1280 before and after submitting; scrollWidth equals the viewport |
| Preview e2e (0016dc0 tests) | PASS | 200 passed, 70 skipped (local-stack tests), 0 failed |

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, b2cd487) | PASS. 67 files, 853 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push b2cd487 | PASS. test-db 14 files / 307 tests; e2e 266 passed, 2 skipped; test, typecheck, lint, format green |
| `E2E_BASE_URL=<preview> pnpm e2e` (b2cd487 tests) | PASS. 198 passed, 70 skipped (local-stack tests), 0 failed. /dev/app sources-{success, partial, location, empty, loading, error}: one H1, axe clean, no side scroll at 375 and 1280 |

### Checks

| Check | Result | Evidence |
|---|---|---|
| /app/sources in the nav after Questions | PASS | src/components/app/AppNav.tsx: Dashboard, Competitors, Questions, Sources, History, Billing; the unit nav test expects Sources after Questions |
| H1 "Sources" + the AEO subtitle; the Measured line (n follows the location) | PASS | preview, every state: H1 "Sources" and "See which sites each AI cites for your questions.". Measured line "Checked 2 d ago · 38 answers · API-measured, directional" on all locations, and "… 19 answers …" on the one-location state, so n follows the filter. The empty state has no line (no run). Unit "rule 3: the freshness line with n and 'API-measured, directional' under the H1" |
| Per-engine cards with "{n} links", counts only, categories only from citations.category, "No links cited by {Engine}" at 0 | PASS | preview: 4 cards ("6 links", "4 links", "10 links", "2 links"), 0 matches for a % at either width. sources-partial shows "No links cited by Perplexity". computeSources reads citations.category only (null/unknown → Other); unit "counts links of ok answers only; failed and no_overview add nothing", "an engine with no links → links 0", "a null or unknown category counts as other" |
| Exact / Country fallback badge with the greyed tooltip copy | PASS | preview: "Exact" and "Country fallback" badges; 2 fallback badges carry title "{Engine} can't target a city yet, so we check it for the whole country." (UI.md copy). Unit "badge: any fallback → fallback; all exact → exact; nothing ran → null" |
| Top domains ≤ 20 with noopener noreferrer | PASS | preview: every domain link has rel="noopener noreferrer". TOP_DOMAINS = 20; unit "top domains cap at 20", "sorted by links then domain" |
| Location selector: works without JS | PASS (re-run) | GET form + Show button since #52; see the re-run table |
| Location selector: unknown key → empty, not everything | PASS | computeSources and src/app/app/sources/page.tsx filter by the exact key; unit "location filter narrows chart and table; an unknown key gives nothing" |
| Palette: tokens only, no status colors; validator output in #45's body | PASS | SourcesView.tsx COLOR uses `var(--color-…)` tokens only (jellyDeep, amber, jelly, warnText, plus striped jellyDeep and inkMuted); moss and brick are not used. #45's body has the dataviz validator output (`--pairs all` on paper: lightness, chroma, CVD and normal-vision PASS, a contrast WARN relieved by visible counts + table, inkMuted's chroma FAIL by design for the neutral Other) and the lead's Q3/O1 choice |
| computeSources unit tests: failed/no_overview excluded, deleted question, ordering | PASS (one gap) | failed/no_overview and ordering (fixed engine and category order, top domains by links then domain, locations city → state → country) are covered. No explicit deleted-question test, but it holds by construction: computeSources only sees questions from the `questions` table (getQuestionsWithLatestAnswers), so a deleted question's answers (question_id null) never attach |
| Copy | PASS | unit "uses only strings that are in docs/COPY.md"; category labels and "All locations" / "Location" are in COPY.md "Sources (lead, 2026-11-05)" |

Not blocking:
- No explicit deleted-question unit test for computeSources (see above).
- With JavaScript off, /dev/app renders a blank page: its content is in hidden streaming templates that need JS to show. The signed-in /app/sources can't be checked from here without a hosted login, but it uses the same Suspense streaming.

First-run blocker (b2cd487):

| Blocker | Result | Evidence |
|---|---|---|
| The location selector changed the page only via onChange → window.location.assign, with no name, form or submit (src/components/app/LocationSelect.tsx:14-21) | FIXED by #52 (0016dc0) | re-run table above |

### Blocking problems

None.

## Step 8: Self-serve shell (Dashboard, Competitors, Questions, History) (re-run)

Checked 2026-11-05 on main at 1c6a54e:
- #38 (a91c6eb): self-serve shell queries
- #41 (f91a8ad): competitor suggestions and visibility series
- #43 (4feb18b): sources fields and shell lint
- #40 (1c6a54e): self-serve shell and pages

The sandbox Docker disk is full, so there was no local Supabase. test-db and e2e come from CI on main's push of 1c6a54e (run 42053783602). Unit, typecheck, lint, format and build ran locally in the sandbox. The UI checks ran from the Mac on #40's preview at 138cf81, whose tree is identical to 1c6a54e. No live paid calls, fake Example data only.
Preview: https://rank1-o1xmctq6w-bryan-flowhighlevels-projects.vercel.app (sha 138cf81, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §6 Step 8, the lead's brief (rank1-step8.md), docs/UI.md 4b rows Dashboard / Competitors / Questions / History, docs/PRODUCT.md rule 3.

Result: PASS. The first run's blocker (Competitors broke product rule 3) is fixed by #47 (merged as 6ed31af). No blocking problems.

Re-run 2026-11-05 on #47's preview at 319d441, whose tree is identical to main 6ed31af: https://rank1-mkm6pwzwx-bryan-flowhighlevels-projects.vercel.app

| Check (375 and 1280) | Result | Evidence |
|---|---|---|
| Competitors phone cards show n | PASS | 375 competitors-success: "Example Ramen House · You · 33% (named in 80 of 240 answers)", "Example Noodle Bar · 100% (named in 240 of 240 answers)", "Example Izakaya · too few answers" |
| Competitors freshness + label line | PASS | competitors-success and competitors-partial at both widths: exactly one "Checked 2 h ago · 240 answers · API-measured, directional" |
| History label once | PASS | history-success and history-partial at both widths: "API-measured, directional" appears exactly once; rows keep date + "named in … of …" |
| axe, no side scroll | PASS | 0 violations on all 4 states at 375 and 1280; scrollWidth equals the viewport |
| Preview e2e (6ed31af tests) | PASS | 184 passed, 70 skipped (local-stack tests), 0 failed |

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, 1c6a54e) | PASS. 65 files, 831 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push 1c6a54e | PASS. test-db 14 files / 307 tests; e2e 250 passed, 2 skipped; test, typecheck, lint, format green |
| `E2E_BASE_URL=<preview> pnpm e2e` (1c6a54e tests) | PASS. 182 passed, 70 skipped (local-stack tests), 0 failed, including 48 app-shell tests: all 22 /dev/app states with one H1, axe clean and no side scroll at 375 and 1280, the drawer keyboard test, and 44px tap targets |

### Checks

| Check | Result | Evidence |
|---|---|---|
| Nav: only existing pages; content full width | PASS | src/components/app/AppNav.tsx links exactly /app, /app/competitors, /app/questions, /app/history, /app/billing (all exist under src/app/app). Unit "lists Dashboard, Competitors, Questions, History, Billing and marks the current one", "is hidden during onboarding". Gallery pages are single-column full width |
| SoV only on Competitors | PASS | `shareOfVoice` is rendered only in src/components/app/CompetitorsView.tsx. Dashboard uses `Leaderboard top={5} change={false}` without SoV. Preview: "share of voice" only on competitors-success. Unit "leaderboard top 5 without SoV" |
| Dashboard: hero + n + change; 8-run line hidden under 2 runs; per-engine; top 5; "What to fix next" without why_note; partial badge; empty / unpaid / first-check states | PASS | Unit Dashboard tests: no business, no run yet (paid first-check / unpaid "Start for $99/mo"), success, partial + no fixes + under 2 runs. series.test.ts "hidden with fewer than 2 points", "the latest 8 complete/partial runs", "n = 0 → value null". getTopFixes "never why_note" (db), and no component reads why_note. Preview dashboard-success: n ("named in … of …"), "checked … ago" and "API-measured, directional" at both widths |
| Competitors: You row pinned; 'too few answers' under n<10; suggestions with Add / Not a competitor (dismissed not re-suggested); manual add; dfy_client can't write | PASS except the rule 3 blocker below | Phones: cards sort the You row first (CompetitorsView.tsx:67-69); desktop table has the infoBg You tag. Preview shows "too few answers" for Example Izakaya. suggest.test.ts: minus tracked, dismissed and the business itself; cache with no token; missing keys → nothing. db: "adds, dismisses idempotently and un-hides on re-add", "hidden competitors drop out of the next run's tracked brands", "a non-member, anon and a dfy_client cannot change competitors (42501)". Unit: the empty copy and the manual add form |
| Questions: dots 3/3/3/1, failed '–' tooltip, location badge, drawer (focus trap, Esc, noreferrer links) | PASS | Unit "rows with per-engine counts, location badge, a failed '–' with the lead tooltip, and a drawer". Tooltip "This check failed. It doesn't count toward your numbers." is in COPY.md. Drawer links have rel="noopener noreferrer" (QuestionsView.tsx:117). Preview e2e "questions drawer: keyboard opens it, Tab stays inside, Esc closes and focus returns" at both widths |
| History: rows → /app/runs/[id], CSV | PASS | Unit "one row per run, newest first: date, visibility + n, change, status; opens the run; CSV per run". Preview history-success shows "named in … of …" per row |
| run_summaries parity with computeMetrics | PASS | CI db shell.test.ts "listRunSummaries matches computeMetrics on the same run, overall and per engine, with a deleted question"; also newest first, never free audits, non-member and anon get nothing |
| Copy | PASS | unit "app shell copy uses only strings that are in docs/COPY.md" |


First-run blocker (1c6a54e):

| Blocker | Result | Evidence |
|---|---|---|
| Competitors page broke product rule 3: phone cards showed a bare % with no n (src/components/app/CompetitorsView.tsx:83), and there was no freshness or "API-measured, directional" at either width | FIXED by #47 (6ed31af) | re-run table above. History now carries the label too |

### Blocking problems

None.

## Step 7: Metrics + same-day audit + CSV/PNG export

Checked 2026-11-05 on main at cea874b:
- #34 (12eb3c3): free audit jobs and result queries
- #36 (205b612): metrics, CSV and free audit pipeline
- #35 (cea874b): audit progress, results and exports

The sandbox Docker disk is full, so there was no local Supabase. test-db and e2e come from CI on main's push of cea874b (run 42044513854). Unit, typecheck, lint, format and build ran locally in the sandbox. The UI checks ran from the Mac on #35's preview at efc029d, whose tree is identical to cea874b. No live paid calls, fake Example data only, and no real lead was created.
Preview: https://rank1-he9qxzzvc-bryan-flowhighlevels-projects.vercel.app (git ref feat/step7-audit, sha efc029d, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §6 Step 7, the lead's brief (rank1-step7.md), docs/UI.md 4b rows "Audit progress" (151) and "Audit results (paid + free)" (152).

Result: PASS. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, cea874b) | PASS. 62 files, 803 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push cea874b | PASS. test-db 13 files / 297 tests; e2e 200 passed, 2 skipped; test, typecheck, lint, format green |
| CI on #34 (fe72b00), #36 (260a58d), #35 (efc029d) before merge | PASS. 9 of 9 each |
| `E2E_BASE_URL=<preview> pnpm e2e` (cea874b tests) | PASS. 134 passed, 68 skipped (local-stack tests), 0 failed |

### Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Metrics: failed + no_overview excluded; deleted question's answers excluded on paid runs; SoV; leaderboard "too few answers" under n < 10; change vs previous | PASS | src/lib/metrics/compute.ts: `counted` keeps status ok only, plus question_id not null on paid runs (free audits count all). SoV = answers naming the business / tracked-brand mentions (each brand once per answer). The leaderboard sets `tooFew` when n < 10, and change = floored points vs the previous run. tests/unit/metrics/compute.test.ts: "failed and no_overview leave the denominator", "a partial run", "paid runs skip answers of deleted questions; free audits count them", "tooFew under 10 answers", "ties: business first", "change = whole points (floored) vs the previous run; null without one", SoV "zero mentions anywhere → value null, not 0%", sources from ok answers only. db: getPreviousRun returns the latest earlier complete/partial run |
| 2 | CSV: brief's columns, RFC 4180, formula guard (= + - @) | PASS | src/lib/metrics/csv.ts: columns question, engine, run_index, status, mentioned, first_position, location_used, location_supported, checked_at, cited_domains (unique, citation order, "; " joined); CRLF; quotes cells with , " or line breaks and doubles quotes; prefixes `'` to cells starting with = + - @ tab or CR. csv.test.ts covers fixed columns + CRLF, quoting, `=HYPERLINK("x")`, `+1+1`, `-2`, `@SUM(A1)`, tab and CR, and safe cells left alone |
| 3a | POST /api/audit/request still 202, unchanged copy | PASS | route stores the lead, then schedules the audit with next/server `after()`, and answers 202 `{status:"queued"}` either way (routes.test.ts "still answers 202 when after() can't schedule the audit"). The success copy is unchanged since #21 (src/components/forms/copy.ts diff: 0 lines; e2e "Got it. We'll email your audit to owner@example.test." passed). Preview without a Turnstile token: 403 `{"error":"turnstile"}`, so I created no real lead |
| 3b | free_audits / run_jobs unreadable by anon/authenticated; create_free_audit service-only | PASS | Migration 0012: free_audits has RLS on, ALL revoked, no policies. create_free_audit checks `auth.role() = 'service_role'` and is revoked from public, anon and authenticated. db free-audit.test.ts: "refuses signed-in users and anon (42501)", "no free-audit row is readable by signed-in users or anon", "is atomic: invalid input stores nothing", "a paid job still requires question_id, and a free job may not have one"; run-jobs.test.ts: jobs unreadable |
| 3c | Notify: complete/partial email once; failed marked sent=false; 5-attempt cap; no email/token in logs | PASS | src/lib/audit/notify.ts: one Resend email per lead (idempotency key = lead id), COPY.md subject and body, failed run → markNotified(sent=false) and no email, send failure → bump attempts. `listUnnotifiedFreeAudits` filters notify_attempts < 5 (MAX_NOTIFY_ATTEMPTS = 5). Runs after each cron drain (src/app/api/cron/run-jobs/route.ts). Unit notify.test.ts: complete and partial send, failed not emailed, send failure bumps, missing env skips, a throwing query doesn't stop the loop, "log lines never contain the email, token or domain". db: "stops listing a run after 5 failed attempts", "lists finished runs once; marking removes them" |
| 4a | /dev/audit states per UI.md 151/152 at 375 + 1280 with axe | PASS | preview e2e "/dev/audit {progress, progress-error, results, partial, failed, free-progress, free-results}: one H1, axe clean, no side scroll" on both viewports; "keyboard reaches both downloads, and cited links carry no referrer"; "tap targets are at least 44px on the results page". "API-measured, directional" is on every results state |
| 4b | /audit/<unknown> → 404 with Referrer-Policy: no-referrer + noindex | PASS | preview: /audit/NoSuchTokenAbC123 (and lowercased) → 404, `referrer-policy: no-referrer`, `x-robots-tag: noindex, nofollow`, `<meta name="robots" content="noindex">`. Same headers on its export.csv / export.png 404s (plus no-store). e2e "an unknown audit token is a 404, sent with no referrer and not indexed" passed local and preview |
| 4c | Mixed-case token handling | PASS | CI e2e tests/e2e/audit-db.spec.ts builds a mixed-case token (`AbC-dEf_…`) and loads /audit/<token> with status 200, no-referrer and noindex/nofollow. It also checks the lead email isn't on the page and downloads CSV and PNG |
| 4d | Another workspace's /app/runs/<id> → 404 | PASS | CI e2e "paid run: the member sees results and downloads; anyone else gets a 404"; db "getRunResults … null for others". Preview signed out: /app/runs/<id> and its export.csv → 307 /signin?next=… |
| 4e | Powered-by credit + paywall card only on free | PASS | preview /dev/audit: "Powered by Rank1" only on free-progress and free-results, "Start for $99/mo" only on free-results, neither on any paid state. e2e asserts the credit count per state, and audit-db.spec.ts sees the credit on a real free audit |
| 4f | Export headers: attachment, no-store | PASS | unit exports.test.ts "downloads are attachments, never cached, never indexed" and "every /audit page and export sends Referrer-Policy: no-referrer"; CI e2e: free CSV `content-disposition: attachment; filename="rank1-audit-exampleramen.test.csv"`, `cache-control: no-store`, PNG 200 |

Not blocking:
- /dev/audit shows its fake numbers without a visible "Example data" badge. /dev/ui and /dev/onboarding have one. Every brand is "Example …" with .test domains, the numbers come from src/components/audit/example-data.ts through computeMetrics, and the page 404s in production.
- With no cuisine found, the generic templates' {cuisine} slot reads "restaurants" (lead, 2026-11-05). The brief said to use the generic templates only, so this records the decision.

### Blocking problems

None.

## Step 6: Run orchestration + mention detection (3/3/3/1)

Checked 2026-11-05 on main at cd57c03: #26 (7cdc6b7, run jobs and orchestration RPCs) and #27 (cd57c03, job worker, mention detection, citation categories). The sandbox Docker disk is full, so there was no local Supabase. test-db and e2e come from CI on main's push of cd57c03 (run 42034578435). Unit, typecheck, lint, format and build ran locally in the sandbox. The cron 401 check ran from the Mac on #27's preview at 247a400. Its app code is identical to cd57c03: the only differences are a PROGRESS.md line and #29's two e2e skip lines. No live paid calls.
Preview: https://rank1-1x17lu5xu-bryan-flowhighlevels-projects.vercel.app (git ref feat/step6-worker, sha 247a400, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §6 Step 6 and the lead's brief (rank1-step6.md).

Result: PASS. No blocking problems.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox, cd57c03) | PASS. 48 files, 709 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on main push cd57c03 | PASS. test-db 12 files / 284 tests; e2e 168 passed, 2 skipped; test, typecheck, lint, format green |
| CI on #26 (420bb15) and #27 (247a400) before merge | PASS. 9 of 9 each |

### Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | create_run: 10 jobs per active question (3/3/3/1, 250 for 25); refuses unpaid non-DFY and non-members; 1 audit per business per 24 h; 1 open run | PASS | supabase/migrations/20261105000011_run_jobs.sql: jobs_total = n × 10 and one job per question × (chatgpt 3, gemini 3, google_aio 3, perplexity 1). subscription_status must be active or trialing unless service = 'dfy' (P0402); a non-member or anon gets 42501; a queued or running run blocks a new one (P0409); a member's second audit in a rolling 24 h gets P0429, and failed audits don't count. tests/db/run-jobs.test.ts, all green in CI: "makes 10 jobs per active question, 3/3/3/1 by engine: 250 for 25 questions", "refuses unpaid workspaces with P0402, unless the business is dfy", "refuses non-members and anon with 42501", "refuses a second run while one is queued or running (P0409)", "a member gets one audit per business per rolling 24 h (P0429)", "a failed audit does not count, and the cap resets after 24 h", "weekly runs are service role only" |
| 2 | Jobs unreadable by users | PASS | run_jobs has RLS on, ALL revoked from anon and authenticated, and no policies. claim_jobs, finish_job and job_error are revoked from authenticated (service role only). Test: "members and anon cannot read or write jobs, or call the worker functions" |
| 3 | Mention detection has no LLM; tests cover aliases, case/diacritics, possessives, & vs and, substring false positives, domains, ordering | PASS | `git grep` for openai, @anthropic-ai, @google/genai, @google/generative-ai, cohere-ai, @mistralai, langchain, ai imports in src and package.json: 0 matches. src/lib/runs/mentions.ts is text matching only. tests/unit/runs/mentions.test.ts covers every listed case: aliases, case and diacritics, possessives (straight and curly), & vs 'and', substring false positives, a shorter brand inside a longer one, domains (bare and distinctive label, stoplist under 5 characters), and ordering by first appearance |
| 4 | Citations deduped by normalized URL | PASS | src/lib/runs/citations.ts `normalizeUrl` (lowercase host, no trailing slash, no utm_*, no #fragment) and `toStoredCitations` (keeps the first, renumbers positions). Unit: categorize.test.ts and process-job.test.ts ("deduped, categorized citations"). DB: finish_job "stores the answer and citations, deduping repeated URLs" |
| 5 | GET /api/cron/run-jobs is 401 without the bearer, on a preview | PASS | preview: no Authorization 401 `{"error":"unauthorized"}`; `Bearer wrong` 401; empty bearer 401; Basic auth 401; POST 405. `cronAuthorized` (src/lib/runs/drain.ts:10) also refuses when CRON_SECRET is unset. CRON_SECRET is set on Vercel for preview and production |
| 6 | vercel.json cron is `* * * * *` | PASS | vercel.json `crons: [{ "path": "/api/cron/run-jobs", "schedule": "* * * * *" }]` |

Also verified (brief): claim_jobs uses `FOR UPDATE SKIP LOCKED` and re-claims a stale lock (10 minutes), with at most 3 attempts. finish_job is atomic and idempotent. no_overview counts as ok, and failed answers are stored as failed. Run status is complete, partial or failed with finished_at. All covered by CI db tests ("is exclusive under parallel calls", "re-claims … and fails it after 3 attempts", "is atomic", "is idempotent", the status mixes).

Not blocking:
- `cronAuthorized` compares the header with `===`, not a constant-time compare. Low risk for a 1-minute cron with a long random secret.
- After a valid bearer, a claim error returns up to 200 characters of the database error text in the 500 body. Only the cron caller sees it.

### Blocking problems

None.

## Step 5: Local competitors + restaurant onboarding (re-run)

Checked 2026-11-05: the merged backend and data-pipeline work on main, plus the onboarding UI in PR #21 (feat/step5-onboarding) at b8453fd, its head:
- #20 (227a30f): onboarding RPCs, seat rule, DFY create, fixes RLS
- #23 (a7e6d31): Maps adapter, readSite, suggestQuestions, CUISINES
- #24 (57c0000): take_rate_token, lookup_cache

The sandbox Docker disk is full, so per the lead there was no local Supabase. test:db and e2e come from CI on #21 (run 42028278532 at b8453fd). Unit, typecheck, lint, format and build ran locally in the sandbox. The preview checks ran on the Mac from a temporary detached worktree of b8453fd (removed afterwards). No live Maps, site or engine calls (no keys).
Preview: https://rank1-9uifpq0e4-bryan-flowhighlevels-projects.vercel.app (sha b8453fd, READY).
Sources: Jeun's ENG_HANDOFF_OVERNIGHT §6 Step 5, the lead's brief (rank1-step5.md), docs/UI.md 4b Onboarding 1/2/3.

Result: PASS. The first run's blocker (4 admin e2e failures on the preview) is fixed by #29 on main (e893356). No blocking problems.

Re-run 2026-11-05: #21 is still at b8453fd, behind main and showing merge conflicts on GitHub, so its own e2e files don't have #29 yet. As agreed with the lead, I ran #21's tests with main's tests/e2e/admin-test.spec.ts (the only e2e file #29 changes: 2 `test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase")` lines) against #21's preview as-is. Once #21 merges main, its head sha changes and needs a fresh CI run and Visuals comment.

### Commands

| Command | Result |
|---|---|
| `pnpm test` (sandbox) | PASS. 47 files, 665 tests passed |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (sandbox) | PASS |
| CI on #21 at b8453fd | PASS. 9 of 9; test-db 11 files / 261 tests, e2e 176 passed |
| `E2E_BASE_URL=<preview> pnpm e2e` (first run, #21 tests) | FAIL. 114 passed, 60 skipped, 4 failed: tests/e2e/admin-test.spec.ts:48 and :56 × 2 viewports, "Local Supabase is not running" |
| `E2E_BASE_URL=<preview> pnpm e2e` (re-run, #21 tests + main's admin-test.spec.ts) | PASS. 114 passed, 64 skipped, 0 failed. The 4 admin tests now skip; dev-onboarding.spec.ts ("every 4b onboarding state, accessibly") passes at 375 and 1280; the onboarding specs that need local Supabase skip |

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

First-run blocker:

| Blocker | Result | Evidence |
|---|---|---|
| e2e on the preview: tests/e2e/admin-test.spec.ts:48 and :56 had no preview skip | FIXED on main by #29 (e893356) | re-run above: 0 failed, the 4 tests skip |

### Blocking problems

None.

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
