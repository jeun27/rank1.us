# COPY

Every customer-facing string Rank1 may use, copied verbatim from build pack section 4 (docs/UI.md). Do not write new copy. Safe claim wording and the DO NOT USE list are in docs/AEO.md.

## Shared components (from section 4, Components and Jelly)

| Component | Spec | Source |
|---|---|---|
| Freshness | Caption inkMuted: 'Checked 14 h ago · 250 answers · API-measured, directional'. | PAGE + this pack |
| Error banner | errorBg fill, 1px error hairline, radius 8, 48px worried Jelly, one error-colour sentence + one fix action as a text link. | (Design v3, Jeun 2026-11-06) |

### Final set strings (Final set, Jeun 2026-11-05)

| Where | String |
|---|---|
| Field + Button placeholder (landing) | "yourbusiness.com" |
| Field + Button placeholder (empty state) | "yoursite.com" |
| Field + Button loading label | "Checking…" |
| Field + Button error (no ending) | "Add the ending, like ramenhouse.com" |
| Disabled button | "Add business" (disabled) |
| Field + Button input label (screen readers only; from the final CTA form field "your domain") | "Your domain" |

Progress percentages ("48%") are computed from n of d, so they are not copy.

### Forms (lead, 2026-11-05)

| Where | String |
|---|---|
| Contact field labels | "Name", "Email", "Company", "Tier", "Message" |
| Contact submit (idle form of 'Sending…') | "Send" |
| /contact H1 and modal title | "Contact us" |
| Contact tier options (no dollar amounts) | "Agency bundle", "Done-for-you (custom)", "Other" |
| Audit form labels | "Email", "Your domain" (no email placeholder) |
| Audit domain placeholder | "yourbusiness.com" |
| Audit success | "Got it. We'll email your audit to {email}." |
| Audit button helper (lead, founder-approved 2026-11-06), until the email and domain are valid | "Enter your email and website to continue" |
| Audit button helper, once Turnstile shows and until its token arrives | "Check the box to continue" |
| Email error (both forms) | "Add a valid email, like you@ramenhouse.com" |
| Contact name error | "Add your name" |
| Contact message error | "Add a message" |
| Contact tier placeholder option and tier error | "Choose one" |
| Contact company | Optional, no error string |
| Audit Banner error | "That didn't send. Try again in a minute." |
| Audit daily-cap 429 | "Free audits are full for today. Try again tomorrow." (a per-request 429 keeps "Too many tries. Try again in an hour.") |
| Contact modal close button (aria-label) | "Close" |
| Contact industry label (Jeun #22) | "Industry" |
| Contact industry options (Jeun #22, no dollar amounts) | "Restaurant", "HVAC", "Plumbing", "Roofing", "Pest control", "Other" |
| Contact industry empty option and error (Jeun #22) | "Pick your industry." |
| Contact industry "Other" text label, optional, max 60 characters (Jeun #22) | "Your industry (optional)" |

### Auth (lead, 2026-11-05)

| Where | String |
|---|---|
| /signin H1 | "Sign in to Rank1" |
| Google button (primary) | "Continue with Google" |
| Magic-link email label | "Email" (invalid email reuses the forms email error) |
| Magic-link button (secondary) | "Email me a sign-in link" |
| Link sent | "Check your email. We sent a sign-in link to {email}." |
| Link didn't send | "That link didn't send. Try again in a minute." |
| Email link expired or already used | "That sign-in link expired. Enter your email for a new one." |
| Sign-in not configured (/signin?error=config) | "Sign-in isn't available right now. Try again in a few minutes." |
| Account menu label and item | "Account", "Sign out" |
| Landing header link to /signin | "Log in" |
| Placeholder H1s | /app/onboarding "Add your business", /app "Dashboard", /client "Dashboard", /app/billing "Billing" |

| Jelly | Rule |
|---|---|
| Footer credit | 12px flat Jelly + 'Powered by Rank1' (10px) ONLY on the free audit. Never on $99 plan reports. |
| Alt | "Jelly, the Rank1 mascot: a glossy blue gummy blob with two oval eyes"; repeats alt="". |

# 4a. Landing page (rank1.us), exact copy

9 sections in order.

| Section | Exact copy | Notes |
|---|---|---|
| 1 Hero | H1 "Be the brand AI names first." Sub "See how often ChatGPT, Gemini, Google AI Overview and Perplexity name your business, how you stack up against competitors, and what to fix next." Primary "Get my free audit" (-> #audit). Text link "See pricing". Micro "Same-day results as CSV + PNG. No card." Right: card "Example data: named in 34% of 160 answers, +6 pts" + Jelly. | v3 (D37): H1 + CTA left, sub right, then the live demo window (this card line inside it) with a 72px Jelly; stack < md |
| 2 Social proof | "Built for businesses that want AI to name them." 4-5 [PLACEHOLDER LOGO] + 1 [PLACEHOLDER TESTIMONIAL - real, with permission]. Hidden: SHOW_SOCIAL_PROOF=false. | Hidden until real |
| 3 Problem / how it works | H2 "Customers ask AI who to pick. Find out if it names you." Error 'Before' card: "Pasting questions into 4 chatbots by hand and logging answers in a spreadsheet." Steps: 1 "Add your domain - Rank1 suggests questions. 5-minute setup." 2 "Rank1 checks 4 AI engines every week." 3 "You get a monthly report with GA4 traffic, competitor scores and what to fix next." CTA "Get my free audit". | DECIDED: monthly report, weekly checks (Proposals #6) |
| 4 Features (3 cards) | "One dashboard": visibility % with sample size, change since last week's check, competitor leaderboard, every weekly check kept in History. "Reports that send themselves": monthly, white-label with your logo, GA4 traffic, competitor scores, what to fix next; no 'Powered by Rank1' on the $99 plan. "Set up in 5 minutes": auto-suggested questions. Small moss and amber icons. | DECIDED: monthly report, weekly checks |
| 5 Screenshots | H2 "What you see on Monday." Tabs: Dashboard · Monthly report · Audit CSV; 1px hairline border; label "Example data". CTA "Get my free audit". | Tablist, arrow keys |
| 6 Comparison | H2 "Built for one business, not 500 brands." Columns: Manual checks \| Enterprise AI trackers \| Rank1. Rows: Setup (hours \| sales call + onboarding \| 5 minutes); Competitor leaderboard (manual \| varies \| yes); White-label report (build it yourself \| varies \| yes); GA4 traffic in report (manual \| varies \| yes); Price for one business (your time \| enterprise pricing \| $99/mo self-serve). Footnote "Enterprise column is a general description, not a specific product." CTA "Start with a free audit". No competitor names. | Mobile: scroll, Rank1 column pinned |
| 7 Pricing | H2 "One plan. One business." "$99/mo, self-serve, for 1 business." Includes: 4 AI engines; 25 questions checked every week; one dashboard; competitor leaderboard; white-label monthly report with GA4 link + what to fix next; no 'Powered by Rank1' credit. CTA "Start for $99/mo"; secondary "Get my free audit first". Under the card: "Agency? $99 per business, white-label included. Contact us." Second line: "Want us to do the work for you? Contact us." | '25 questions' + done-for-you line added from locked plan |
| 8 FAQ | Which AI engines? (ChatGPT, Gemini, Google AI Overview, Perplexity) / What does visibility % mean? (the share of answers where AI names your business, always shown with the sample size) / How long is setup? (about 5 minutes) / Can I white-label? (yes; the $99 plan includes white-label reports with your own logo and no Rank1 credit) / Do I need GA4? (optional; adds traffic to the report) / What's in the free audit? (same-day CSV + PNG) / Why do results change week to week? (AI answers vary between runs, so we ask each question several times and show how many answers each number is based on) | details/summary; last Q added (Validator: directional) |
| 9 Final CTA (#audit) | Bordered panel with an accent glow (v3). H2 "Find out if AI names your business first." Sub "Free same-day audit as CSV and PNG (includes a small 'Powered by Rank1' credit)." Form: email + your domain; primary button "Get my free audit". Jelly 96px right, eyes up (hidden on mobile). | Turnstile + honeypot |
| Footer / meta | Footer: Rank1, Pricing, FAQ, Contact us, Privacy, Terms. Meta title "Rank1 - Be the brand AI names first."; description = hero sub; OG image [PLACEHOLDER]. | Contact email shown as the form, not an address |

- Mobile: hero and cards stack below md; comparison scrolls with the Rank1 column pinned; sticky bottom 'Get my free audit' bar after the hero; final-CTA Jelly hidden.
- Accessibility: landmarks, one H1, ordered headings, AA contrast, visible focus, tablist with arrow keys, labeled inputs with error text, prefers-reduced-motion.
- Never echo rank1.so's tagline. No competitor names. No stats on the landing page beyond Example data.

## Mock panel headers (lead, 2026-11-05)

Table headers in the landing page's "What you see on Monday." mock panels. The panels carry the label "Example data".

| String |
|---|
| "Business" |
| "Visibility" |
| "Change" |
| "Question" |
| "Engine" |
| "Named" |
| "Example data" |

## Team workspace (lead, 2026-11-05)

Strings for the /team team workspace shell (ENG_HANDOFF_STEP2 §3). Nav labels are the 4b screen names. Step 11: /team shows real DFY data; Example data only in the /dev/team gallery.

| Where | String |
|---|---|
| Sidebar toggle | "Workspace", "Analytics" |
| Sidebar nav (adds to the 4b screen names) | "Reports", "Settings" |
| Sidebar group | "Recents" |
| Sidebar buttons (labels) | "Help", "Dark theme", "Collapse sidebar" |
| Context pane | "Prompt template", "Copy context", "Copied", "Open in Claude" |
| After Open in Claude | "Brief copied. Paste it in Claude." |
| Clipboard blocked (either button) | "Couldn't copy. Allow clipboard access and try again." |
| Pane divider (label) | "Resize panes" |
| Document tabs | "Document", "New tab", "Close tab", "Expand", "Split" |
| Phone tab bar | "Nav", "Context", "Document" |
| Every pane (gallery only) | "Example data" |
| Client switcher (Step 11) | "Client" (label), "Show" (submit) |
| No DFY clients (Step 11) | "No clients yet." |

## Client invites (lead, 2026-11-05)

Step 12. The team's Clients tab in /team, and the DFY client dashboard (/client).

| Where | String |
|---|---|
| Context pane button and tab | "Clients" |
| Invite form | "Invite client" (heading), "Email" (label), "Send invite" (submit); an invalid email reuses the forms' email error |
| After Send invite | "Invite sent to {email}.", "This email already has a Rank1 account.", "Already invited." |
| Invite failed (retry is safe) | reuses "That didn't send. Try again in a minute." |
| Per client user | "Remove access" |
| Fix list toggle | "Show fix list to client" |
| Remove access or toggle failed | reuses "We couldn't save that. Try again." |
| /client, access removed | "Nothing tracked yet." (no button) |
| /client, no run yet | reuses "No weekly checks yet. Your first one runs Monday." |

## Billing (lead, 2026-11-05)

Step 14. /app/billing and the header Business switcher. The UI.md 4b "Billing + switcher" and "Business switcher" strings are used as written. Amounts are only the x $99 math.

| Where | String |
|---|---|
| Dialogs (Add, Remove) | "Cancel" |
| Switcher row menu (label) | "More for {name}" |
| Switcher search (more than 8 businesses) | "Search businesses" |
| Switcher status dot (screen readers) | "Active", "Paused" (UI.md: success active, error paused) |
| Billing, past due / unpaid / incomplete | "Past due" (warn badge) |
| Remove dialog, no period end known | "the end of this period" (fallback for {period end date}) |
| Billing, paused | "Paused" (warn badge; the plan stays, with 'Manage billing') |
| Billing, paid | "Plan", "{n} businesses x $99 = ${n x 99}/mo" ("1 business" in the singular), "Next invoice {date}" |
| While an added business waits for its seat | "Adding your business…" (after 30 s it stays, with "Try again"; no error) |
| Checkout or portal redirect failed | "We couldn't open billing. Try again in a minute." |
| Add or Remove business failed | reuses "We couldn't save that. Try again." |

## Admin (lead, 2026-11-05)

Strings for /admin/test, the founder-only engine test page (Step 4). Anyone else gets a 404, so there is no not-allowed copy.

| Where | String |
|---|---|
| H1 | "Engine test" |
| Field labels | "Engine", "Question", "Location level" |
| Engine options | "ChatGPT", "Gemini", "Google AI Overview", "Perplexity" |
| Location level options | "Country", "State", "City" |
| Button | "Run test" |
| Button while loading | "Running…" |
| Missing keys | "Missing API keys: {names}. Add them in Vercel to run live tests." |
| Result labels | "Status", "Answer", "Cited links", "Location", "Cost (USD)" |
| Location values | "Exact", "Country fallback" |

## Onboarding (lead, 2026-11-05)

Labels for the 3 onboarding screens (4b Onboarding 1-3). State messages are the 4b strings. Place, dietary and occasion names come from docs/UI.md lists and local_places.

| Where | String |
|---|---|
| Step indicator | "Step 1 of 3", "Step 2 of 3", "Step 3 of 3" |
| Buttons | "Next", "Back", "Finish setup" |
| Business fields | "Business name", "Cuisine", "City", "State", "Landmarks", "Areas", "Dietary", "Occasion" |
| Competitor fields | "Rating", "Domain", "Add competitor", "Remove" |
| Question fields | "Track", "Short form", "Long form", "Location level" |
| Location level options | "Country", "State", "City" |
| Save failure | "We couldn't save your business. Try again." |

## Audit (lead, 2026-11-05)

Strings for the run results page (/app/runs/[runId]) and the free audit (/audit/[token]). State messages are the 4b Audit progress / Audit results strings.

| Where | String |
|---|---|
| H1 | "Audit results" (paid run), "Your free audit" (free audit) |
| Export buttons | "Download CSV", "Download PNG" |
| Whole run failed | "We couldn't finish this audit. Try again later." |
| Per-engine progress | "{done} of {total} answers" |

## Audit email (lead, 2026-11-05)

The free-audit completion email (Step 7). Sent once per lead when its run ends complete or partial; a failed run sends nothing.

| Where | String |
|---|---|
| Subject | "Your Rank1 audit is ready" |
| Body | "Your free audit for {domain} is ready: {link}\n\nAPI-measured, directional. Results are based on {n} AI answers." |
| {link} | NEXT_PUBLIC_SITE_URL + /audit/{token} |
| {n} | successful answers (failed and no_overview excluded) |

## App shell (lead, 2026-11-05)

Strings for the self-serve /app shell (Step 8): the nav and the Dashboard, Competitors, Questions and History pages. State messages are the 4b strings.

| Where | String |
|---|---|
| Nav (label) | "App" |
| Section titles | "Visibility", "Competitors", "What to fix next", "Suggested competitors", "Share of voice" |
| Suggested competitor buttons | "Add", "Not a competitor". Screen readers hear "Add {name}" (F2, lead 2026-11-07): the visible word is "Add", the name is data |
| Questions: failed answer ('–' tooltip) | "This check failed. It doesn't count toward your numbers." |
| Questions drawer | "Close" |
| History status | "Complete", "Failed" |

## App shell (lead, 2026-11-06)

v3 shell (PR 2a): the dark rail and the breadcrumb top bar.

| Where | String |
|---|---|
| Top bar breadcrumb (aria-label) | "Breadcrumb" |
| Breadcrumb first crumb (links home) | "Rank1" |

## Sources (lead, 2026-11-05)

Strings for /app/sources (Step 9). State messages are the 4b Sources strings; the location badge uses "Exact" / "Country fallback" and the engine location tooltip.

| Where | String |
|---|---|
| Subtitle (from AEO.md) | "See which sites each AI cites for your questions." |
| Category labels | "Reddit", "YouTube", "Social", "Review sites", "News and blogs", "Other" |
| Location selector | "Location" (label), "All locations", "Show" (submit) |
| Top domains table headers | "Domain", "Category", "Links", "Engines" |

## Fix list (lead, 2026-11-05)

Strings for /app/fixes (Step 10) and the shared fix list (team and client areas later). State messages are the 4b Fix list strings. Fix titles and details are fixes.title / fixes.detail (the SCHEMA §5b customer copy, filled).

| Where | String |
|---|---|
| Page H1 and Dashboard section | "What to fix next" |
| Section | "Tidy-ups" |
| Status labels | "To do", "Doing", "Done" (select label "Status") |
| Status save failed | "We couldn't save that. Try again." |

# 4b. App screens: every state

Copy in quotes is exact. Every number shows n + checked X ago. Results labeled API-measured, directional.

| Screen | Empty | Loading | Error | Partial | Success | Mobile (< 768) |
|---|---|---|---|---|---|---|
| Sign in | n/a | Button spinner 'Opening Google…' | Banner: "Google sign-in didn't finish. Try again, or use an email link." | n/a | Redirect to onboarding (new) or dashboard | Single column; Google button full width |
| Onboarding 1: Business | Fields blank; Irvine, CA prefilled | 'Reading your site…' skeleton | "We couldn't read that site. Type 3 things you sell." + 3 inputs | Site read but no cuisine found: cuisine select highlighted | Next enabled | Stacked fields, sticky Next bar |
| Onboarding 2: Competitors | "No local {cuisine} places found near {city}. Add competitors by name." | Jelly loading 'Finding {cuisine} places in {city}…' | "Couldn't load nearby places. Add competitors by name." + manual form | < 3 found: list + manual add prompt | 5 pre-ticked rows: name, rating, domain | Rows as cards, checkbox 44px |
| Onboarding 3: Questions + location | Never empty (template fills 25) | Skeleton rows | "Couldn't save question 7: it's empty." inline | Some edited: 'Edited' tag | 25 rows: short form, long form, track toggle, location level | One question per card; long form textarea |
| Audit progress | n/a | Jelly squish "Checking 4 AI engines… 120 of 250 answers" + per-engine bars | "{Engine} isn't answering right now. We'll retry; your other results are saved." | Show finished engines; others 'still checking' | Auto-go to results | Bars stacked |
| Audit results (paid + free) | n/a | Skeleton | Banner + 'Try again' | Engine row greyed: 'No answers from {Engine} yet' | Hero %, per-engine row, leaderboard, top sources, CSV + PNG buttons; free shows paywall card 'Start for $99/mo' | Hero number 48px; tables scroll |
| Dashboard | Jelly + "Nothing tracked yet. Add your domain and I'll find the questions." button 'Add my business' | Skeleton cards | Banner "We couldn't load your results. Try again." | 'Last run partial: 230 of 250 answers' warn badge; numbers use 230 | Hero visibility % + n + change; 8-week line; per-engine; leaderboard top 5; top 3 fixes; freshness | Cards stack; switcher in a sheet |
| Competitors | "No competitors yet. Add 3-5 local places to compare." | Skeleton table | Banner + retry | Brand with < 10 answers: 'too few answers' instead of % | Leaderboard (You row with infoBg 'You' tag), share of voice + n, suggested competitors (Add / Not a competitor) | Table scrolls; You row pinned top |
| Questions | "No questions yet." + 'Use the restaurant template' | Skeleton list | Banner + retry | Engine cells show '–' failed with tooltip | List: question, named on each engine (3 dots for 3 runs), location badge; drawer with answer text + sources | Drawer full screen |
| Sources | "No cited links yet. They show after your first run." | Skeleton bars | Banner + retry | Engine with 0 citations: 'No links cited by {Engine}' | Per-engine bars by category + n links; top domains table | One engine per card |
| Fix list | "Nothing to fix yet. Run your first check." | Skeleton | Banner + retry | Only some checks ran: those rows say 'We couldn’t check this yet.'; note 'Listing and site checks need your website URL' | Ranked fixes with evidence, affected answers, status, 'Start a before/after test' | Cards |
| Experiments | "Changed a page? Test it against questions you didn't change." 'Start a test' | Skeleton | Banner + retry | "Too few answers to call yet. Next check Monday." | Test vs control change, each with n, difference, 'Directional' | Groups stacked |
| Report | "Your first report sends on the 1st." + Preview | PDF building spinner | "The report didn't send to {email}. Check the address." | GA4 not connected: section hidden + 'Connect GA4' link | Preview, logo, color, recipients, 'Send test to me', history | Preview scales to width |
| Settings: business + GA4 | GA4: 'Connect Google Analytics' | 'Connecting…' | "Google didn't give access. Try again and tick the Analytics box." | Connected, no property picked | Property chosen, last sync time; 'testing' note while Google verification pending | Stacked |
| History | "No weekly checks yet. Your first one runs Monday." | Skeleton rows | Banner "We couldn't load your history. Try again." | Partial week: warn badge '230 of 250 answers' | One row per weekly check: date, visibility % + n, change, status; opens that week's results; CSV per week | Rows as cards, newest first |
| Billing + switcher | Unpaid: 'Start for $99/mo' | Spinner on portal button | "Your last payment failed. Weekly checks are paused." 'Update card' | Past due: warn badge | Plan, '2 businesses x $99 = $198/mo', next invoice, 'Manage billing' | Switcher as bottom sheet |
| Contact us | Form: name, email, company, tier, message | Button 'Sending…' | "That didn't send. Try again in a minute." (429: 'Too many tries. Try again in an hour.') | n/a | "Thanks. We'll reply by email within 2 business days." | Full-screen modal |
| Admin (founder) | n/a | Skeleton | Raw error + request id | n/a | Engine test, costs per business, domain categories, leads, contact requests | Desktop only OK |

| Business switcher | Spec |
|---|---|
| Where | Top-bar breadcrumb (Rank1 / business / page), left of the account menu: 'Example Ramen House ▾' (v3, D42; in /team this is the client switcher, D20). Hidden when the workspace has 1 business (shows the name only) until an agency adds a 2nd. |
| List | Each business: name, city, visibility % with n ('34% · 250 answers'), status dot (success active, error paused). Max height 360, search when > 8. |
| Add | Last row: '+ Add a business ($99/mo)'. Dialog: "Add a business? Your plan goes from 1 x $99 to 2 x $99 = $198/mo. Prorated today." Primary 'Add business'. |
| Remove | Business menu -> 'Remove business'. Dialog: "Remove {name}? Checks continue until {period end date}; then your plan drops to {n-1} x $99." Quantity -1 at period end; data kept read-only. |
| Agency hint | Below list, caption: 'Need 10+ businesses or done-for-you? Contact us.' |
| Mobile | Opens as a bottom sheet; rows 56px. |

## Fix list (lead, 2026-11-06)

The check-off Fix list (portal b). Statuses stay "To do" / "Doing" / "Done" in the DB and for read-only viewers.

| Where | String |
|---|---|
| Row actions | "Start" (To do only), "Undo" (done rows and the toast) |
| In progress | "In progress" · {who} · {date}, who = "Rank1 team" for the team, else the member's name (never an email) |
| Done rows | "Done {date}" · {who} (no who when the weekly check closed it) |
| Toast | "Marked “{title}” done" with "Undo" |
| Progress | "{done} of {total} done" |
| Filter (segmented) | "Open", "Done", "All" |
| Tooltips (with aria-keyshortcuts) | "Mark done (x)", "Start (s)" |
| Pillar groups (G5, briefs/rank1-gas.md) | "P5" tag + label, then "{done}/{total}": "Know where you stand" (P0), "Prompts & keywords" (P1), "Content" (P2), "Brand mentions" (P3), "YouTube & video" (P4), "Technical access" (P5), "Measure & prove" (P6). Order P5, P3, P2, P1, P4, P6; empty groups hidden |
| P0 baseline line (G5, REPORT.md) | "Your baseline: {pct} visibility, named in {n} of {d} answers." |

## Experiments (lead, 2026-11-05)

Step 17 before/after test vs control (/app/experiments). The empty, partial and 'Start a test' copy is in the UI.md 4b row above. No p-values or significance words anywhere.

| Where | String |
|---|---|
| Nav (App) | "Experiments" |
| Form labels | "Name", "What changed", "Link to the change", "Change date", "Test questions", "Control questions" |
| Card actions | "End test", "Delete test" |
| Results | "Before", "After", "Change", "Difference"; cells "{pct}% · n={n}"; points "+{n} pts" / "−{n} pts" (floored, never %); tag "Directional" |
| Status tags (lead, 2026-11-06) | "Running", "Done", "Ended" |
| Form errors (lead, 2026-11-06) | "Pick at least 1 test question.", "Pick at least 1 control question.", "Use a link that starts with http:// or https://." |
| Delete confirm (lead, 2026-11-06) | "Delete this test? Its results go too." with "Delete test" and "Cancel" |
| Fix list button (Step 17) | "Start a before/after test" (opens the form for that fix) |

## Report (lead, 2026-11-05)

Strings for the white-label monthly report PDF and email (Step 16). No product name or "Powered by" anywhere. The email From name is the business name. `{Business}` = businesses.name, `{Month YYYY}` = the report month ("October 2026"), `{n}` = the AI answers counted.

| Where | String |
|---|---|
| Email subject | "{Business} AI visibility report, {Month YYYY}" |
| Email body | "Your {Month YYYY} AI visibility report is attached." then a blank line, then "API-measured, directional. Based on {n} AI answers." |
| PDF section headings | "AI visibility", "By engine", "Competitors", "Top sources", "What to fix next", "Weekly checks" |
| PDF footer label | "API-measured, directional" |

/app/report (Step 16 frontend):

| Where | String |
|---|---|
| Page H1 and nav | "Reports" |
| Preview (iframe title) | "Report preview" |
| Settings | "Logo", "Upload logo", "Brand color", "Recipients" (hint "Up to 10 emails, one per line."), "Save" |
| After saving | "Saved." (a failed save reuses "We couldn't save that. Try again.") |
| Logo errors | "Use a PNG or JPEG.", "Logos can be up to 512 KB." |
| Recipients error | "Add up to 10 valid emails, one per line." |
| Test send | "Send test to me" → "Test sent to {email}." / reuses "That didn't send. Try again in a minute." |
| History | "History"; columns "Month", "Status", "Download"; statuses "Queued", "Building", "Ready", "Sent", "Failed" |
| GA4 not connected (partial) | "Connect GA4" (link to /app/settings/connections, only while ENABLE_CONNECTIONS is on; the GA4 section stays hidden) |

## Connections (lead, 2026-11-06)

Strings for Connections. One Google grant covers Business Profile, Search Console, Analytics and YouTube, so disconnecting one disconnects them all.

| Where | String |
|---|---|
| Revoke confirm (any Google connection; G1, lead 2026-11-06) | "This disconnects every Google service Rank1 uses: Business Profile, Search Console, Analytics and YouTube." |

Tile helper text (the niche key in src/lib/connections/recommend.ts):

| Niche key | String |
|---|---|
| local | "For businesses people find on a map." |
| restaurant_booking | "For restaurants that take reservations." |
| site | "For businesses with their own website." |
| dtc_store | "For brands that sell online." |
| dtc_amazon | "For brands that sell on Amazon." |
| saas_reviews | "For software with review listings." |
| ai_referrals | "Shows visits that came from AI answers." |
| video | "For businesses that post videos." |

**C-a, signed off by the lead (2026-11-06).** The hub, Settings → Connections. Every consent line states only what the code does (the scope and openid, the GBP fields after a confirm, review + log, revoke, no passwords).

| Where | String |
|---|---|
| Page title | "Connections" |
| Tier headings | "Recommended", "Optional", "Coming soon" |
| Tile names | "Google Business Profile", "Google Search Console", "Google Analytics", "Website / CMS", "Shopify", "G2 / Capterra", "OpenTable", "Resy", "Apple Business Connect", "Bing Places", "Yelp", "Amazon", "YouTube" |
| Status tags | "Connected", "Needs reconnect", "Disconnected"; a tile without a working flow: "Coming soon" |
| Buttons | "Connect", "Reconnect", "Disconnect", "Notify me", "Continue to Google", "Cancel", "Save" |
| Notify me, after | "We'll let you know." |
| Picker | "Choose locations", "Choose sites", "Choose properties", "Choose channel" (Business Profile / Search Console / Analytics / YouTube) |
| Change log | "Changes"; fields "Description", "Hours", "Special hours", "Website", "Primary phone", "Attributes" with the date |
| Callback banners | "{connector} is connected." / "Nothing was connected: Google access wasn't allowed." / "We couldn't connect that. Try again." |
| Any failed action | "We couldn't do that. Try again." |
| Consent, Google Business Profile | "Rank1 asks Google to manage your Business Profile (business.manage) and to know which Google account you used. We don't get your email or profile.", "We only change these fields, and only after you or the Rank1 team confirm: description, hours, special hours, website, primary phone and attributes.", "Every change is shown before it's applied, and logged with who made it, when, and what changed.", "To stop, use Disconnect here, or remove Rank1 at myaccount.google.com/permissions.", "We never ask for your password." |
| Consent, Search Console | "Rank1 asks Google for read-only access to Search Console (webmasters.readonly) and to know which Google account you used. We don't get your email or profile.", "We can only read. We never change anything in Search Console.", "To stop, use Disconnect here, or remove Rank1 at myaccount.google.com/permissions.", "We never ask for your password." |
| Consent, Google Analytics | "Rank1 asks Google for read-only access to Google Analytics (analytics.readonly) and to know which Google account you used. We don't get your email or profile.", "We can only read. We never change anything in Google Analytics.", "To stop, use Disconnect here, or remove Rank1 at myaccount.google.com/permissions.", "We never ask for your password." |
| Consent, YouTube (G1, lead 2026-11-06) | "Rank1 asks Google for read-only access to YouTube (youtube.readonly) and to know which Google account you used. We don't get your email or profile.", "We can only read. We never change anything on YouTube.", "To stop, use Disconnect here, or remove Rank1 at myaccount.google.com/permissions.", "We never ask for your password." |

**C-c, signed off by the lead (2026-11-06).** The team's Connections document for one DFY client (/team, ENABLE_CONNECTIONS). The G3 notice lives only here (the queue shows the tag).

| Where | String |
|---|---|
| G3 notice | "{Business} is ready for GAS" · "{connections} connected {age} ago." · "Start on the fix list" · "Dismiss" |
| Notify-me interest | "Asked to hear about {connectors}" |
| Change log (team: values) | "Changes"; each entry "Before: …", "After: …", "by Rank1 team" / "by {name}" (a current client user's email, team UI only) / "by a former user" (lead, #160 S1) and the date |

C-c PR 2, Edit Business Profile (team only; v1 the three text fields, lead Q3; production also waits on Google's GBP API access):

- "Edit Business Profile", "Location" (lead approved 2026-11-06), "Description", "Website", "Primary phone"
- "Preview changes", then per field "Before" / "After"; "Apply" only after a non-empty diff
- "No changes to apply."
- "Google changed this profile since your preview. Here's a fresh one."
- "Applied." / "We couldn't apply that. Try again."

C-c task lines (at most one per connection):

- "Ask the client to reconnect {connection}"
- "Ask the client to choose their {locations|sites|properties}" (lead Q5)

C-c PR 3 (lead Q6, 2026-11-06). The team sets a DFY client's narrative words and decides its mention lists. Everything else reuses the G4 and G7 strings, including the editor's labels "Words that fit you" and "Words to avoid", which are the client's words.

- Client switcher row and document title: "How AI describes {Business}" (in the team view "you" would mean the team)

**C-b, signed off by the lead (2026-11-06).** The onboarding connect step and the dashboard card, plus the G3 client "You're all set" state. "{names}" joins the connector names with "and"; one name reads "is connected".

| Where | String |
|---|---|
| Card title | "Connect your accounts" |
| Card intro | "One click each, with Google's own sign-in. We never see your password, and you can disconnect any time." |
| Card count | "{n} of {m} connected" |
| Onboarding step | "Skip for now", "Go to your dashboard" |
| All set, title | "You're all set. We'll take it from here." |
| All set, self-serve (review: nothing reads connections yet) | "{names} are connected." |
| All set, DFY client (lead Q1: no timing; review: the hub's "Changes" label) | "{names} are connected. The Rank1 team takes it from here, and every change shows under Changes." |
| Onboarding step 1, behind ENABLE_CONNECTIONS | "What kind of business?" |
| Business types | "Restaurant", "HVAC", "Plumbing", "Roofing", "Pest control", "Auto repair", "Beauty & salons", "Gyms & fitness", "Events & venues", "Dental", "Software (SaaS)", "Online store", "Other" |

## GAS (lead, 2026-11-06)

Strings from the GAS prototype report (share/gas-proto/REPORT.md, lead copy). Fix rule R16 (pillar p5, SCHEMA.md 5b):

| Where | String |
|---|---|
| R16 title | "Your site lets AI in, but Cloudflare may be blocking it." |
| R16 customer copy | "Your site runs on Cloudflare. Its AI bot blocking is on by default for many new sites, and robots.txt can't show it. Check Security, then Bots, in your Cloudflare dashboard." |
| R17 title (G7, the grouped fix) | "Get on these lists" |
| R17 customer copy, one list (lead, 2026-11-06) | "1 list AI cites names {rivals} but not you." |
| R17 customer copy, 2+ lists (lead, 2026-11-06) | "{n} lists AI cite name {rivals} but not you." |
| R17, one list, no known rivals (lead, #131) | "1 list AI cites doesn't name you." |
| R17, 2+ lists, no known rivals (lead, #131) | "{n} lists AI cite don't name you." |
| R18 title (G2, JS-empty homepage) | "Your homepage needs JavaScript to show its text" |
| R18 customer copy (lead, every vertical) | "Your homepage shows almost no text without JavaScript, so ChatGPT can't read what you offer." |
| R19 title (G1) | "Put your keyword in your video titles" |
| R19 customer copy | "{n} videos need your keyword in the title." / one: "1 video needs your keyword in the title." |
| R20 title (G1) | "Put your keyword in the first two lines of the description" |
| R20 customer copy | "{n} videos don't have your keyword in the first two lines of the description." / one: "1 video doesn't have your keyword in the first two lines of the description." |
| R21 title (G1) | "Add chapters on videos 5 minutes or longer" |
| R21 customer copy | "{n} videos 5 minutes or longer have no chapters." / one: "1 video 5 minutes or longer has no chapters." |
| G2 edge hint (the GPTBot-UA request got a different answer: a soft hint, never "blocked") | "Your site may be blocking AI crawlers at the edge (for example a Cloudflare bot setting). Check your bot settings." |
| G2 panel title (/audit, and the evidence in the R14/R16/R18 fixes) | "Can AI see your site?" |
| G2 count | "{n} of 6 AI crawlers can read your site" |
| G2 answer, good | "AI can read your site." |
| G2 answer, a search crawler blocked (R14's OAI-SearchBot, PerplexityBot) | "AI search can't read your site: {bots} {is/are} blocked in robots.txt." |
| G2 answer, only other crawlers blocked (info; lead N2: ChatGPT-User is a user-triggered fetcher, not training) | "AI search can read your site. You block {n} other AI crawlers, which is your call." (n=1: "1 other AI crawler") |
| G2 answer, unreachable (the domain only when it's a hostname) | "We couldn't reach {domain}." / "We couldn't reach your site." |
| G2 JavaScript-off row | "With JavaScript off", "{n} words show" |
| G2 crawler access | "Allowed", "Blocked", "No rule" |
| G2 table headers (lead C1) | "Crawler", "Access", "robots.txt line" |
| G2 checked line | "Checked {age} ago · robots.txt + homepage" |
| G2 explainer | "We read robots.txt and load your homepage the way AI crawlers would." |
| G2 dashboard line (/app, good only) | "AI can read your site · checked {age} ago" |

**G4 "How AI describes you", signed off by the lead (2026-11-06).** /app/settings/narrative and the /app Dashboard. A word match on stored answer text, never an LLM reading.

| Where | String |
|---|---|
| Dashboard card title (a clash only) | "How AI describes you" |
| Settings page title | "How should AI describe you?" |
| Lists | "Words that fit you", "Words to avoid" |
| Helper | "Short words or phrases, up to 8 each. We match the words and their endings, not synonyms, so "cheap" won't catch "affordable"." |
| Clash | "{n} of {d} answers use words you want to avoid: {words}" |
| Snippet label | "Word match" |
| No clash (Settings) | "No clashes. None of your "avoid" words came up." |
| Per-word count (lead: every count carries its base) | "in {n} of {d} answers" / "not yet" |
| Hint | "Words that never come up are the next thing to say on your own pages." |
| No words (one quiet Dashboard line) | "Tell us the words that fit you, and we'll check every AI answer for them." + "Add your words" |
| Actions | "Edit words", "Remove {word}", "Add", "Save" |
| Saved | reuses "After saving" above (lead C3) |
| Save failed (inline) | "We couldn't save that. Try again." |
| Inline errors | "Up to 8 words.", "2 to 40 characters.", "That word is in the other list." |


G3 team tags on the /team client queue (X5, planner 11:13; lead-approved prototype copy):

| Where | String |
|---|---|
| Queue status tags | "Needs attention" (error) · "Ready for GAS" (success) · "Waiting on client" (warn) · "In progress" (neutral) |

## G7 mentions (lead, 2026-11-06)

G7 "Lists that name your rivals but not you" (/app/sources, and the R17 fix's evidence), signed off by the lead (2026-11-06).

| Where | String |
|---|---|
| Section title | "Lists that name your rivals but not you" |
| Section sub | "Pages AI cites that name competitors but not you" |
| Row | "Names {rivals}" (up to 3), then "+{n}"; "In {k} of {n} answers" + " · {engines}" |
| Actions | "Add to fixes", "Not relevant", "Added", "View", "Remove", "Restore" |
| Not relevant disclosure | "Not relevant ({n})" |
| Empty, before the first run | "No lists like this yet. They show after your first run." |
| Empty, a run with no lists | "None in your last run. We check again on every run." |
| Save failed (inline on the row) | "We couldn't save that. Try again." |
| R17 evidence, more than 3 | "+{n} more" |
| New-tab links (visually hidden, #142 review) | "(opens in a new tab)" |

**G1 YouTube, signed off by the lead (2026-11-06).** Each P4 fix (R19 title, R20 description, R21 chapters) shows its own failing videos from the stored evidence (#150 review: no live read, no full checklist per fix). Behind ENABLE_CONNECTIONS.

| Where | String |
|---|---|
| Header | "Keyword: {keyword}" |
| Under R19 only | "Says the keyword: Can't check" |
| No keyword (the YouTube tile, plain text, no action, lead Q2) | "Add your main keyword to check your videos." |
| Suggest fix (copy-only) | "Suggest fix", "Copy", "Copied", "Apply in YouTube" (disabled) + "Coming soon" |

Suggest fix templates (copy-only, nothing is written to YouTube):

- R19 title: "{keyword} | {title}"
- R20 description, the opening to put before the first line (the stored evidence has no description): "{keyword} at {business}:"
- R21 chapters: "0:00 Intro"

## Landing (lead, 2026-11-06)

| Where | String |
|---|---|
| Hero demo, under the leaderboard | "From {n} answers" (the sample size, n = the demo fixture's answers; the demo shows "From 160 answers") |

## UX (lead, 2026-11-06)

Strings the lead approved for the UX plan (share/ux-plan §C; founder OK 2026-11-06 07:58 UTC, lead sign-off 08:06 + 08:08 UTC).

| Where | String |
|---|---|
| The fixes page, everywhere (X16) | "What to fix next": the /app and /team rail item and the page and document title (/team said "Fix list") |
| Questions dot legend, above the list (X18) | "Named" · "Not named", each beside the real filled / hollow dot |
| Free audit CTA panel, after the leaderboard (X4) | "Rank1 checks these 4 AI engines every week and shows you what to fix next." with the existing "Start for $99/mo" (the 4 is the count of engines the audit table renders, ENGINES) |
| First-check empty states (X25), chosen from run state | A first check queued or running: "Your first check is running." (no action). None queued: Fix list and Dashboard "Your first check runs Monday." + "Review your questions" (→ /app/questions); /client "The team's first check runs Monday."; History keeps "No weekly checks yet. Your first one runs Monday." + "Review your questions" |
| /client slot 2 section title (X3) | "What the team did" |
| Phone bottom bar, last item (X2) | "More" (opens the other pages and Account) |
| Competitors add form, empty submit (X26; lead 2026-11-06, WCAG 3.3.1) | "Add a name first." inline under Name, tied to it with aria-describedby |
| Competitors add form, submit (X26; lead 2026-11-06) | "Add" (the disclosure above it keeps "Add competitor") |
| Reports status line, first on the page (X10; §C, lead edit b) | "Next report {date} to 1 recipient." · "Next report {date} to {n} recipients." · no saved recipients: "Next report {date}. Add a recipient to send it." ({date} as "Dec 1") |
| Reports, the folded settings (X10) | "Branding" (logo, brand color, recipients, Save). The preview fold reuses "Report preview" |
| Experiments "Start a test", under the test questions (X22; §C) | "Control: the other {n} questions" (n=1: "Control: the other question") + text action "Edit" (opens the control list) |
| Experiments "Start a test", under a disabled Start (X22; §C) | "Pick at least one test question and a name." (tied with aria-describedby, gone once both are there) |
| Onboarding step 1, beside a disabled Next: the first missing field (X24; §C) | "Add your business name first." · "Pick a cuisine first." · "Add your city first." · "Add your state first." |
| Onboarding step 2, beside Next while the place search runs (X24; §C) | "Finding places near you…" |
| Onboarding step 3, sticky bar beside Finish setup (X23; §C, lead edit a) | "{n} of {total} questions tracked" ({total} is the plan limit, MAX_ACTIVE_QUESTIONS) |

## Sign-in emails (founder-approved 2026-11-07)

The Supabase auth emails in supabase/templates/ (#193). Magic link = magic_link.html (type=magiclink), Confirm signup = confirmation.html (type=signup). Both emails share every line unless the row says otherwise.

| Where | String |
|---|---|
| Subject (both) | "Sign in to Rank1" |
| HTML title (both) | "Sign in to Rank1" |
| Inbox preview text (both) | "Your Rank1 sign-in link. It works once and expires in 1 hour." |
| Logo alt (both) | "Rank1" |
| Heading, Magic link | "Here’s your sign-in link" |
| Heading, Confirm signup | "Welcome to Rank1" |
| Reason line, Magic link | "You asked to sign in to Rank1 with this email address." |
| Reason line, Confirm signup | "You asked to sign in to Rank1 for the first time with this email address." |
| Button (both) | "Sign in to Rank1" |
| Under the button, Confirm signup only | "Next: add your business and see how often AI names you." |
| Expiry line (both) | "This link works once and expires in 1 hour." |
| Fallback line (both) | "Button not working? Copy this link into your browser:" (then the plain link URL) |
| Ignore line (both) | "Didn’t ask for this? You can ignore this email." |
| Footer (both) | "Rank1 · rank1.us" (rank1.us links to https://rank1.us) |
## Privacy: Google user data (lead-approved 2026-11-07 for Google OAuth verification; founder to review)

The /privacy section Google OAuth verification needs. The Limited Use sentence is Google's wording, word for word; "Google API Services User Data Policy" links to https://developers.google.com/terms/api-services-user-data-policy and "Google Account permissions" to https://myaccount.google.com/permissions. Last updated 2026-11-07.

| Where | String |
|---|---|
| Heading | "Google user data" |
| Intro | "When you sign in with Google or connect a Google service, Rank1 receives only this:" |
| Sign-in | "Google sign-in: your Google account email and name." |
| Business Profile | "Google Business Profile (the business.manage scope): Rank1 reads your listing details and applies only the edits you approve." |
| Search Console | "Google Search Console (the webmasters.readonly scope): read-only access to your site's search data." |
| Analytics | "Google Analytics, GA4 (the analytics.readonly scope): read-only access, used to show AI-referred traffic in your reports." |
| YouTube | "YouTube (the youtube.readonly scope): read-only access to your channel's videos." |
| Use | "Rank1 uses this data only to show you your own business's visibility and fixes." |
| Storage | "Google access tokens are stored encrypted. You can disconnect any Google service at any time from Connections in Rank1, or from your Google Account permissions." |
| Never | "We never sell your Google data, use it for ads, or use it to train AI models." |
| Limited Use | "Rank1's use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements." |

## Onboarding v2 (founder-approved P2, 2026-11-07)

O1 only (share/ux-plan/onboarding-welcome/README.md §6). Each string lands here in the PR that first uses it.

| Where | Copy |
|---|---|
| Welcome (Q1) | Field label "Your website" · button "Read my site" · "No website? Fill it in yourself" · "About 5 minutes to set up." |
| Welcome (Q2) | "What happens next" · "Rank1 reads your site and fills in a card you can change." · "Pick 3 to 5 businesses to compare against." · "Rank1 writes up to {total} questions people ask AI about businesses like yours." · Example panel title "What you'll see after your first check" · footnote "Every number shows how many answers it's based on." |
| Example panel | You row "Your business" with the "You" tag (never the real name) · headers "Business", "Visibility" · label "Example data" |
| Reading log (Q4) | Title "Reading {domain}" · count "{n} of 4" · stages "Opened {domain}"; "Business details": "Found {fields} in schema.org" / "Not on your site"; "Title and description": "Found in the page head" / "Not on your site"; "Services": "Reading your menu links…", then "{n} found in your menu" / "Not on your site" · note "No AI reads your site. Rank1 only looks at what your pages already say." · button while reading "Reading…" |
| Unreadable (Q8) | "We couldn't read that site. Fill in your business below." (the empty card follows) |
| Rail (Q3) | Steps "Your site" · "Your business" · "Competitors" · "Questions" (list name "Add your business"; a finished step reads "Done" to screen readers) · phones "Step {n} of 4 · {step}" |

## Engine location tooltip

Greyed tooltip copy: "{Engine} can't target a city yet, so we check it for the whole country."

## Question templates

| Short form | Long form (~20-25 words) | Origin |
|---|---|---|
| best {cuisine} in {city} | I'm in {city}, {state} with two friends tonight; where can we get really good {cuisine} that isn't too expensive and has quick seating? | Pack draft |
| {cuisine} near {landmark} | We're near {landmark} in {city} and want {cuisine} for lunch in under an hour; which nearby places are actually worth going to and why? | Pack draft |
| best {cuisine} for a date in {city} | Looking for a {cuisine} restaurant in {city} for a date night this weekend, nice but not stuffy, good drinks too; what would you recommend and why? | Pack draft |
| family friendly {cuisine} {city} | Where should a family with two young kids get {cuisine} in {city}, somewhere with easy parking, a kids menu and space for a stroller? | Pack draft |
| {cuisine} delivery {city} | Which {cuisine} places in {city} are best for delivery tonight, food that still tastes good after twenty minutes in a bag and fair prices? | Pack draft |
| best {cuisine} near {landmark} | We'll be around {landmark} in {city} this evening and want really good {cuisine}; which places nearby are worth the trip, and why? | Growth (new) |
| {dietary}-friendly {cuisine} in {area} | I eat {dietary} and I'm in {area}, {city}; which {cuisine} restaurants have plenty of clearly labeled {dietary} dishes, not just one side salad? | Growth (new) |
| best {occasion} restaurant at {landmark} | Planning a {occasion} at {landmark} in {city} this Saturday; which restaurant there would you book for good food, a comfortable noise level and easy reservations? | Growth (new) |
| {cuisine} with outdoor seating in {area} | Where can we get {cuisine} with nice outdoor seating in {area}, {city}, somewhere relaxed for a sunny afternoon with a small group of friends? | Growth (new) |
| late-night {cuisine} near {landmark} | It's 10:30 pm and we're near {landmark} in {city}; which {cuisine} places are still open late and actually good, not just fast food? | Growth (new) |
| best ramen in Irvine | I'm in Irvine tonight and craving a rich bowl of ramen; which ramen shops are the best right now, and how long are the waits? | Growth Page (cuisine = ramen) |
| best Korean BBQ in Irvine | Taking four friends out for Korean BBQ in Irvine this weekend; which places have the best meat quality and service for a group? | Growth Page (cuisine = Korean BBQ) |
| best hot pot in Irvine | Which hot pot restaurant in Irvine is best for a cold night with friends, with good broth choices, fresh ingredients and fair prices? | Growth Page (cuisine = hot pot) |
| best dim sum in Irvine | Where should my family go for weekend dim sum in Irvine, with classic dishes done well and a wait that isn't too long? | Growth Page (cuisine = dim sum) |
| best sushi in Irvine | Looking for the best sushi in Irvine, very fresh fish and a good chef's choice option without spending a fortune; where would you go? | Growth Page (cuisine = sushi) |
| best Sichuan in Irvine | Which Sichuan restaurants in Irvine are truly spicy and authentic, good for mapo tofu and dan dan noodles, and worth the drive? | Growth Page (cuisine = Sichuan) |
| best pho in Irvine | Where's the best pho in Irvine for a quick lunch, with a deep, clear broth, generous portions and reasonable prices for the area? | Growth Page (cuisine = pho) |
| best brunch in Irvine | Where can we get a great weekend brunch in Irvine, with good coffee, creative dishes and a table without a two-hour wait? | Growth Page (cuisine = brunch) |
| date night at Irvine Spectrum Center | Planning a date night at Irvine Spectrum Center; which restaurant there has the best food and atmosphere for a relaxed dinner for two? | Growth Page (every Irvine business) |
| lunch near Irvine Business Complex | I work near the Irvine Business Complex and have 45 minutes for lunch; which nearby restaurants are good, quick and not overpriced? | Growth Page (every Irvine business) |
| best {category} in {city} | I'm in {city}, {state} and need a {category} I can trust; who are the best options nearby, and what makes them stand out? | Onboarding v2 Q10 |
| {service} in {city} | I need {service} at my place in {city}, {state} this week; which local businesses do it well, at a fair price, and can come soon? | Onboarding v2 Q10 |
| emergency {category} near me in {city} | It's late and I have an emergency at home in {city}, {state}; which {category} can come out tonight, and who answers fast? | Onboarding v2 Q10, trades only |
| affordable {service} in {city} | I'm on a tight budget and need {service} in {city}, {state}; who does good work without overcharging, and what should I expect to pay? | Onboarding v2 Q10 |
| {category} with good reviews in {city} | Which {category} in {city}, {state} has the best recent reviews from real customers, and what do people say they do better? | Onboarding v2 Q10 |
| who does {service} near {area} | I live near {area} in {city} and need {service}; which local businesses cover my area, and who would you call first and why? | Onboarding v2 Q10 |
| best {category} brands | I'm shopping for {category} and want something that lasts; which brands are worth the money right now, and how do they differ? | Onboarding v2 Q10 |
| where to buy {service} | Where can I buy {service} online from a brand I can trust, with fair shipping and easy returns if it doesn't work out? | Onboarding v2 Q10 |
| {category} brands like {competitor} | I like {competitor} but want to try something similar; which other {category} brands are as good or better, and how do they compare? | Onboarding v2 Q10 |
| best {category} software | We're a small team picking {category} software this month; which tools are best right now, and what is each one best at? | Onboarding v2 Q10 |
| {category} tools for small businesses | I run a five-person business; which {category} tools are easy to set up, fairly priced and good enough to grow with? | Onboarding v2 Q10 |
| alternatives to {competitor} | We use {competitor} but it's getting expensive and clunky; what are the best alternatives right now, and why switch? | Onboarding v2 Q10 |

The 12 "Onboarding v2 Q10" rows (local service, dtc, saas; "trades only" = hvac, plumbing, roofing, pest_control, auto): short forms founder-approved (P3), long forms lead-approved under P3, 2026-11-07.

- **{dietary}**: vegan, vegetarian, gluten-free, halal, kosher
- **{occasion}**: date night, birthday, business lunch, large group
- **{landmark}, {area}**: from local_places for the business's city (max 3 each picked in onboarding)
- **Max per business**: 25 active questions
