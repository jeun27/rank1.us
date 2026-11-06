# Section 4. Full UI spec

Design v3 (Jeun 2026-11-06: "yes to all, O2"), then the template portal look (D44, founder 2026-11-06 05:23-05:31 UTC). Pure black surfaces, 1px hairlines instead of shadows, compact Inter type, mono for numbers only, 6px radii, dense controls, one accent: white in dark (#1A5FBF in light). Decisions, the before/after and every contrast pair: [docs/design/v3.md](design/v3.md). This replaces the "Field Notes" world (paper, Fraunces, pills, light-only customer pages). Sections 4a and 4b below keep their exact copy; only the visual notes changed.

## Themes

- Dark is the default on every surface: landing, /signin, /audit, /app, /client, /team, /admin (D32).
- /app, /client and /team add a light theme, toggled by "Dark theme" (aria-pressed). It defaults to dark, the choice is saved in localStorage, and it is set by `data-theme` on `<html>`, never by a CSS media query (D40 = O2).
- The landing, /signin and /audit are dark only.
- The nav rail is always dark, even in the light theme (D14).
- The monthly report PDF and the white-label report stay light: they are printed and client-branded.

## Color tokens

Same token names in both themes, so every component switches with `data-theme`.

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| page | #000000 | #F6F7F9 | Page background |
| panel | #0A0A0A | #FFFFFF | Panels, cards, table surfaces, pane backgrounds |
| raised | #111214 | #F0F2F5 | Hovered or selected rows, secondary buttons, KPI tiles, active tab |
| overlay | #18191B | #E8EBEF | Menus, popovers, tooltips, the switcher list |
| rail | #000000 | #000000 | Nav rail, both themes |
| hairline | rgba(55, 65, 81, 0.55) | #E2E5EA | 1px borders and dividers (decorative) |
| hairlineStrong | #41454D | #CDD1D8 | Active-tab ring, menu border |
| controlEdge | #71767F | #7D838D | 1px edge of inputs, selects, chips and secondary buttons (≥3:1, WCAG 1.4.11) |
| text | #EDEEF0 | #111316 | Primary text |
| text2 | #B3B7BF | #4A4F57 | Secondary text, rail labels |
| muted | #8C919B | #646A73 | Captions, table headers, 'Checked 14 h ago' |
| accent | #FFFFFF | #1A5FBF | The one accent (D44, was Jelly blue in D34): primary button fill, chart business line (R3), active nav icon, the landing glows |
| onAccent | #000000 | #FFFFFF | Text on the accent fill (white buttons, black text) |
| accentHover | #E5E5E5 | #18579F | Primary button hover |
| link | #FFFFFF | #1A5FBF | Links and secondary text actions, always underlined (R1: never colour alone) |
| success / successBg | #5FBF8E / #13291F | #2F6F4F / #E6EFE9 | Up / visible / complete |
| error / errorBg | #F08A7E / #33191A | #B3443A / #F7E6E3 | Down / alerts / 'Before' / failed |
| warn / warnBg | #E8B45F / #2E2312 | #8A5A12 / #FBEFD9 | 'Moved', partial runs, "Doing". A state colour only, never a button |
| info / infoBg | #79C0FA / #14263B | #1A5FBF / #E5EFFC | Info badge, 'You' row and tag, 'Example data', info banners, focus rings (R2: the blue stays) |
| jelly | #279EF2 | #279EF2 | The mascot (never recoloured); no longer the accent (D44) |

Rules:
- One accent. Amber and green are state colours, not brand colours. Do not use Supabase green or any competitor's colour.
- Status colours only where they carry meaning.
- The dark accent is white, so text on it is #000000 (21:1). Headings h1/h2 in /app, /team and /client fade from white to 60% white (heading-gradient, -0.04em, dark only; forced colours show plain text). No glows in the app areas; the landing keeps its glows (D39).

## Contrast (checked, WCAG AA)

Text needs 4.5:1. UI edges and chart lines need 3:1.

| Pair | Dark | Light |
|---|---|---|
| text on page / panel / raised / overlay | 18.09 / 17.05 / 16.14 / 15.15 | 17.36 / 18.61 / 16.59 / – |
| text2 on page / panel / raised / overlay | 10.44 / 9.84 / 9.32 / 8.75 | 7.69 / 8.24 / 7.35 / – |
| muted on page / panel / raised / overlay | 6.64 / 6.26 / 5.92 / 5.56 | 5.09 / 5.45 / 4.86 / – |
| link on page / panel / raised / overlay | 21.00 / 19.80 / 18.74 / 17.59 | 5.71 / 6.12 / 5.45 / – |
| onAccent on accent / on accentHover | 21.00 / 16.67 | 6.12 / – |
| accent line or icon on page / panel / raised | 21.00 / 19.80 / 18.74 | 5.71 / 6.12 / 5.45 |
| success on successBg | 6.84 | 5.10 (5.99 on panel) |
| error on errorBg | 6.67 | 4.57 (5.52 on panel, 4.92 on raised) |
| warn on warnBg | 8.15 | 5.19 (5.91 on panel) |
| info on infoBg | 7.83 | 5.27 |
| controlEdge on page / panel / raised / overlay | 4.60 / 4.34 / 4.11 / 3.85 | 3.82 on panel / 3.40 on raised |
| rail text / rail icon on rail | 9.73 / 6.19 | same (rail is dark) |
| competitor-average line (text at 60%) | 6.42 | 4.88 |

Hairlines (1.1–1.4:1) are decorative dividers only. No control relies on a hairline alone.

## Shape, depth and glow

| Token | Value | Use |
|---|---|---|
| radius control | 6px | Buttons, inputs, selects, chips, tabs, menu rows (D35) |
| radius panel | 8px | Cards, panels, banners, tables, panes |
| radius frame | 10–12px | Landing frames: demo window, bento, pricing, final CTA |
| radius tag | 4px | Badges and tags |
| radius full | 9999px | Avatars, status dots, progress tracks only |
| depth | 1px hairline | Panels and cards have no shadow (D36) |
| shadow-overlay | 0 16px 40px rgb(0 0 0 / 0.5) | Menus, popovers and tooltips only |
| shadow-window | 0 30px 80px -20px rgb(0 0 0 / 0.7) | The landing demo window only |
| glow | radial-gradient of Jelly blue (#279EF2) at 18%, blurred | Decorative only, on the landing: hero, behind the demo, pricing top edge, final CTA corner. Never in /app, /team or /client (D44). Never behind text that needs it for contrast (D39) |
| heading-gradient | linear-gradient(180deg, #FFFFFF, 60% white), background-clip text, -0.04em | App h1/h2 in /app, /team and /client, dark only; plain text in light and in forced colours (D44) |
| aurora | linear-gradient(90deg, #E8B85A, #5FB8B3, #279EF2), 2px ring | Google sign-in button only (kept, on a 6px shape) |

## Type

Inter (variable, optical size 14–32; SIL OFL) for all text. JetBrains Mono (SIL OFL) for data only (D33). Weights 400/500/600 only (lead F1, 2026-11-06); Mono 400/500. Each face is one variable file from next/font (display swap, metric-matched fallback). No faux bold or italic (`font-synthesis: none`). Tabular figures everywhere: a global rule covers numbers (`data-computed`), mono and table cells.

| Role | Font | Size / line, weight |
|---|---|---|
| Landing display (H1) | Inter 600, -0.04em | fluid 40/41 → 68/69 |
| Landing H2 | Inter 600, -0.03em | fluid 26/29 → 40/44 |
| Landing lead | Inter 400, text2 | 17/27 → 18/28 at md+ |
| Landing body | Inter 400 | 15/24 |
| App page title (H1) | Inter 600, -0.02em | 22/28 (`text-title`) |
| Section / card title | Inter 500 | 13/18 (`text-section`) |
| UI body, table cells, nav | Inter 400 | 13/19 |
| Caption, table header, freshness | Inter 400–500, muted | 12/16 |
| Tag / badge | Inter 500 | 11/1 |
| Form fields (input, select, textarea) | Inter 400 | 16px below md to prevent iOS focus zoom; the UI size (13/19) from md (lead R2, 2026-11-06) |
| Hero number | Inter 600, -0.04em, tabular | 36–44 / 1.1 |
| KPI and table numbers | JetBrains Mono 500, tabular, -0.03em | 22–24 (KPI), 12–13 (tables) |

- **Mono is for data only:** numbers, percentages, answer counts ("240 answers" counts in tables), deltas ("+2 pts"), rank numbers, domains, and the typed demo question.
- Mono is never used for headings, nav, labels, eyebrows, buttons, status words ("To do", "Doing") or sentences ("named in 9 of 30 answers" stays Inter).
- No serif. No italic accent words. No eyebrow labels above headings. No 01/02/03 labels.
- `text-wrap: balance` on headings, `pretty` on body.

## Components

| Component | Spec |
|---|---|
| Button primary | Accent fill (white in dark, D44), onAccent text (black), Inter 500 13px, 32h (40h in the landing hero, 36h in forms), radius 6, no shadow. Hover accentHover. Press translateY(1px). Focus 2px info-blue ring offset 2 (R2). Loading: same fill + 14px spinner + the loading label ('Checking…'). One per screen; the header CTA is the secondary style |
| Button secondary (`alt`) | Raised fill, text colour, 1px controlEdge, same sizes. Hover overlay fill |
| Text action | Link colour, Inter 500, trailing 12–14px drawn arrow that nudges 2px on hover. 44px tap area on touch |
| Button disabled | A real `<button disabled>`: raised fill, muted label at 75% opacity, controlEdge at 60%, 14px lock icon (WCAG 1.4.3 exempts disabled controls) |
| Aurora button | Google sign-in only: panel fill, 2px aurora ring, radius 6, accent spinner + label |
| Field + Button (DomainField) | Input 40h (36h in forms), page fill, 1px controlEdge, radius 6, 16px globe icon, primary button inside on the right. Focused: accent edge + 3px accent ring at 25%. Error: error edge + 12px error text below (aria-describedby). Below 21rem the button drops under the input, full width |
| Chip / filter | 26h, radius 6, 1px controlEdge, Inter 500 12px. On: raised fill, text colour, 6px accent dot. Off: muted text |
| Segmented control | 2–3 options, radius 6, page fill with hairline. Selected: overlay fill + hairlineStrong ring. Arrow keys move the selection (radiogroup) |
| Tabs (document / landing) | 30–40h, selected = raised fill + 2px accent underline (document tabs) or an overlay pill (landing tablist). Arrow keys |
| Card / panel | Panel fill, 1px hairline, radius 8, padding 16 (14 dense, 12 mobile), no shadow |
| Badge / tag | Radius 4, 20h, Inter 500 11px, state fill + text + 25% state-colour hairline. Delta badges ('+2 pts') use mono |
| Table | Panel fill. Header row: Inter 500 12px muted, `position: sticky; top: 0`, panel background. 1px hairline row dividers. Row hover = 4–5% text tint. Numbers right-aligned in mono. You row on infoBg with the 'You' tag. **Leaderboard: at most 3 numbers per row** (rank, visibility %, change), sample size under the table. **Approved exception (D22):** the /team Competitors table view shows 4 per-engine numbers per row, with each engine's n under it. On phones the You row is pinned under the header |
| Chart | Lines and bars only. Business line = accent 2–2.5px. Competitor average = text at 60%, dashed 4/3. Axis labels mono 10.5px muted. Direct endpoint label instead of an open tooltip. Tooltip on hover/focus: overlay fill, hairlineStrong edge, shadow-overlay. No donut/Sankey/gauge/heatmap |
| Freshness | 14–16px clock icon + caption muted: 'Checked 14 h ago · 250 answers · API-measured, directional' |
| Error banner | errorBg fill, 1px error hairline at 30%, radius 8, 48px worried Jelly, one error-colour sentence (Inter 500) + one fix action as a text action on the right |
| Info banner | infoBg fill, 1px info hairline at 25%, radius 8, 28px info icon chip, info-colour text |
| Empty | Panel, 56px Jelly, centred message, and one next step: a DomainField ('yoursite.com' / 'Add my business'), one action, or none while a first check is running (X25: the sentence follows run state) |
| Loading + progress | Panel, squishing 64px Jelly, 14px accent spinner + message, 6px track (overlay) with an accent fill (scaleX transform), 'n of d answers' muted left, the floored percent in link colour right (both mono). Reduced motion stops the spinner and squish |
| Nav rail | Rail colour, 220–232px (64 collapsed), icon 16px + label Inter 400 13px, 32h rows, radius 6. Groups separated by 1px hairlines; no group headings unless COPY.md has them. Active: raised fill + hairline ring + accent icon. Account at the bottom. Phones (X2): a fixed bottom bar in the rail colour, 4 × ≥56px targets with the safe-area inset: Dashboard · What to fix next · Competitors · More. "More" opens a sheet with the other pages and Account. No sideways row |
| Top bar | 48h, page fill, bottom hairline. Breadcrumb 'Rank1 / [avatar] business / page' with drawn slash separators (D42). /app shows the business name only (one business). /team puts the client switcher in the breadcrumb (D20). Right side: Location select, the theme toggle (/app, /team), Account |
| Context panel (/team) | Right side, toggled by "Context" (D21). Freshness + facts card, the item list, then the Prompt template composer (page fill, hairline, radius 8, accent focus ring) with "Copy context" (primary) and "Open in Claude" (text action). Nothing calls a model |
| Logo | Bar mark (public/logo-mark.svg, currentColor) left of the wordmark 'Rank1' in Inter 600 15–16px, -0.02em, 8px gap. App icon unchanged |
| Spacing | 4-pt: 4 8 12 16 20 24 32 48 64 96. Landing sections 96 / 64 mobile, max width 1160. App pages max 1200, padding 24 (16 mobile) |
| Breakpoints | sm 640, md 768, lg 1024. Stack below md. Dense 26–32px controls are for pointer use at md+ (target ≥ 24px, WCAG 2.5.8). Below md every interactive target is ≥ 44px. Sticky mobile CTA bar on the landing |
| Motion | One focal moment per page: the landing demo (type the question, fill the engine bars, count up, the You row climbs past a rival). App motion 120–260ms: view fade 200ms, menu 160ms from its trigger, Context panel 260ms. One ease, cubic-bezier(.16,1,.3,1), as the `--ease-out` token: it is the default for every transition (150ms unless a class picks another step) and the `ease-out` utility. No inline curves or one-off durations below 120ms (tests/unit/tokens.test.ts). Loops pause offscreen and when the tab is hidden. Reduced motion: no spatial movement or loops; opacity and colour feedback stay; the demo shows its final state |
| Browser surfaces | `::selection` accent at 35%, caret and `accent-color` accent, thin scrollbar in hairlineStrong, `color-scheme` per theme |

## Jelly

| Jelly | Rule |
|---|---|
| Asset | /public/jelly.png (background removed). Swap to jelly.svg when a vector exists |
| Rules | One Jelly per screen. Never recoloured. No mouth, limbs, props or text. Expressions are eyes only: neutral, happy, worried, looking, sleepy. **Small** (D41) |
| Hero | 72px on the bottom-right corner of the demo window (60px below 1220px, hidden on phones), eyes toward the score; the eyes follow the You row as it climbs |
| Final CTA | 96px, eyes up, hidden on mobile |
| Empty | 48–64px, eyes toward the button |
| Loading | 64px. Squish scaleY 0.95 → 1.0, ~1.2 s loop with a blink; static under prefers-reduced-motion |
| Error | 48px worried, inside the error banner |
| Favicon | The bar app icon: ink #1E2320 rounded square, three paper #F7F4EE bars (src/app/icon.svg on a 32 grid; apple-icon.png 180). Unchanged |
| Footer credit | 12px flat Jelly + 'Powered by Rank1' (10px) ONLY on the free audit. Never on $99 plan reports |
| Alt | "Jelly, the Rank1 mascot: a glossy blue gummy blob with two oval eyes"; repeats alt="" |

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

- Mobile: hero and cards stack below md; comparison scrolls with the Rank1 column pinned; sticky bottom 'Get my free audit' bar after the hero; final-CTA Jelly hidden; the header hides Contact us below md (pricing and the footer keep it, X20).
- Hero sub: the engine names are plain ink text, not bordered chips (X20, founder OK 2026-11-06; replaces that part of D37).
- Accessibility: landmarks, one H1, ordered headings, AA contrast, visible focus, tablist with arrow keys, labeled inputs with error text, prefers-reduced-motion.
- Never echo rank1.so's tagline. No competitor names. No stats on the landing page beyond Example data.

# 4b. App screens: every state

Copy in quotes is exact. Every number shows n + checked X ago. Results labeled API-measured, directional.

| Screen | Empty | Loading | Error | Partial | Success | Mobile (< 768) |
|---|---|---|---|---|---|---|
| Sign in | n/a | Button spinner 'Opening Google…' | Banner: "Google sign-in didn't finish. Try again, or use an email link." | n/a | Redirect to onboarding (new) or dashboard | Single column; Google button full width |
| Onboarding 1: Business | Fields blank; Irvine, CA prefilled | 'Reading your site…' skeleton | "We couldn't read that site. Type 3 things you sell." + 3 inputs | Site read but no cuisine found: cuisine select highlighted | Next enabled | Stacked fields, sticky Next bar |
| Onboarding 2: Competitors | "No local {cuisine} places found near {city}. Add competitors by name." | Jelly loading 'Finding {cuisine} places in {city}…' | "Couldn't load nearby places. Add competitors by name." + manual form | < 3 found: list + manual add prompt | 5 pre-ticked rows: name, rating, domain | Rows as cards, checkbox 44px |
| Onboarding 3: Questions + location | Never empty (template fills 25) | Skeleton rows | "Couldn't save question 7: it's empty." inline | Some edited: 'Edited' tag | 25 rows: short form, long form, track toggle, location level | One question per card; long form textarea |
| Audit progress | n/a | Jelly squish "Checking 4 AI engines… 120 of 250 answers" + per-engine bars | "{Engine} isn't answering right now. We'll retry; your other results are saved." | Show finished engines; others 'still checking' | Auto-go to results | Bars stacked |
| Audit results (paid + free) | n/a | Skeleton | Banner + 'Try again' | Engine row greyed: 'No answers from {Engine} yet' | Hero %, per-engine row, leaderboard, top sources, CSV + PNG buttons; free shows paywall card 'Start for $99/mo' | Hero number 44px; tables scroll |
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

| Engine | Runs | Country | State | City | How |
|---|---|---|---|---|---|
| ChatGPT | 3 | Country | Greyed | Greyed | DataForSEO LLM Scraper; location_code country |
| Gemini | 3 | Country | Greyed | Greyed | DataForSEO LLM Scraper; coordinate effect untested |
| Google AI Overview | 3 | Yes | Yes | Yes | DataForSEO SERP location_code / location_name |
| Perplexity | 1 | Yes | Yes | Yes | Agent API web_search user_location {country, region, city} |

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

- **{dietary}**: vegan, vegetarian, gluten-free, halal, kosher
- **{occasion}**: date night, birthday, business lunch, large group
- **{landmark}, {area}**: from local_places for the business's city (max 3 each picked in onboarding)
- **Max per business**: 25 active questions

## Irvine places

| Irvine place (seed + tests/fixtures/irvine.ts) | Kind |
|---|---|
| UC Irvine | landmark |
| Irvine Spectrum Center | landmark |
| Diamond Jamboree | landmark |
| Irvine Business Complex | landmark |
| John Wayne Airport | landmark |
| OC Great Park | landmark |
| The Market Place (Tustin/Irvine edge) | landmark |
| Irvine Valley College | landmark |
| Concordia University Irvine | landmark |
| Culver Plaza | landmark |
| Heritage Plaza | landmark |
| Park Place | landmark |
| Eighteen Main (SOL Mexican Cocina, KIT Coffee, The Goldfinch, Izakaya Osen, The Trough, Fat of the Land; checked 11/4/26) | landmark cluster |
| Woodbridge | area (village) |
| Northwood | area (village) |
| Turtle Rock | area (village) |
| University Park | area (village) |
| Quail Hill | area (village) |
| Westpark | area |

Up to 25 active questions per business = templates x the cuisine, landmarks, areas, dietary and occasion options the user picks; both forms editable. Restaurant fixtures: irvine_restaurants.csv (718 rows, cluster tags; ratings dropped as UNVERIFIED). Dev/test only, never shown as real scores.
