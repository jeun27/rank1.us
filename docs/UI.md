# Section 4. Full UI spec

Source: field-notes-spec.md + UI/UX Page section 13. PAGE = from research #4. ADOPTED = approved by Jeun, adjustable. Screens below supersede #4 Sections 3-4.

## Colors

| Token | Value | Use | Source |
|---|---|---|---|
| paper | #F7F4EE | Page background | PAGE |
| ink | #1E2320 | Text; final CTA band | PAGE |
| inkMuted | #5C625E | Secondary text, captions, 'checked X h ago' | ADOPTED |
| moss | #2F6F4F | Visible / up / success only | PAGE |
| amber | #D98E2B | 'Moved' highlight fill; final CTA button (ink text). Never text on paper (2.44:1) | PAGE |
| brick | #B3443A | Down / alerts / 'before' problem only | PAGE |
| jelly | #279EF2 | Mascot and large decorative fills. Never text, never white text on it | PAGE |
| jellyDeep | #1A5FBF | Primary button (white text), links, focus ring | PAGE |
| border | ink 15%, 1px | Cards, tables, inputs | PAGE |
| successBg | #E6EFE9 | Success badge/banner (moss text, 5.10:1) | ADOPTED |
| errorBg | #F7E6E3 | Error banner (brick text, 4.57:1) | ADOPTED |
| warnBg / warnText | #FBEFD9 / #8A5A12 | 'Moved' badge (5.19:1) | ADOPTED |
| infoBg | #E3EEFB | Info badge, 'You' row tag (jellyDeep text, 5.21:1); info banner icon chip | ADOPTED |
| white | #FFFFFF | Surface: cards, fields, banners, aurora button; text on jellyDeep | (Final set, Jeun 2026-11-05) |
| jellyLoading | #316FC5 | Primary button while loading (white text, 4.99:1). The design's jellyDeep at 85% opacity was 4.29:1 | (Final set, Jeun 2026-11-05) |
| fieldBorder | ink 50%, 1px | Domain field edge (3.18:1 on white and paper; the design's ink 10% was 1.22:1 and failed WCAG 1.4.11) | (Final set, Jeun 2026-11-05) |
| auroraAmber / auroraTeal | #E8B85A / #5FB8B3 | Aurora ring stops only (with jelly). Never text | (Final set, Jeun 2026-11-05) |

Contrast: ink/paper 14.53, white/jellyDeep 6.12, jellyDeep/paper 5.57, moss/paper 5.45, ink/amber 5.97, brick/paper 5.03. Never: white on jelly (2.89), jelly text on paper (2.64), amber text on paper (2.44). Light mode only on customer pages; the /team workspace is light + dark with an always-dark nav (see "Team workspace dark theme" below; Jeun, ENG_HANDOFF_OVERNIGHT §3 / ENG_HANDOFF_STEP2 §3). (Final set, Jeun 2026-11-05): white/jellyLoading 4.99, brick/white 5.52, jellyDeep/white 6.12, inkMuted/white 6.24, jellyDeep/infoBg 5.21, fieldBorder/white 3.18. Disabled pill text is inkMuted at 75% opacity (3.45:1); WCAG 1.4.3 exempts disabled controls, so it must be a real `<button disabled>`. The aurora ring is decorative (stops 1.84-2.89 on white); the button is identified by its jellyDeep label.

## Team workspace dark theme (ENG_HANDOFF_STEP2 §3, lead 2026-11-05)

/team only, set by `data-theme="dark"`. The team nav always carries it, in both themes; the panes follow the toggle in the sidebar (defaults to the system setting, saved in localStorage). Same token names as the light set, so every component switches with it. `raised` is new in both themes: selected rows, active tab, composer (light #FFFFFF).

| Token | Dark value | Contrast |
|---|---|---|
| paper (sidebar, page) | #0B0B0C | |
| white (panes, cards) | #121214 | |
| raised | #1E1E21 | |
| ink | #F2EFE9 | 16.30 on white, 14.49 on raised |
| inkMuted | #A9A9AE | 8.00 on white, 7.11 on raised |
| amber (accent, may be text in dark) | #D98E2B | 7.00 on white, 6.22 on raised |
| jellyDeep (links, focus, primary button with white text) | #7AAEF5 | 8.20 on white; white on it 8.20 |
| jellyLoading | #9DC2F7 | white on it 10.24 |
| moss / successBg | #5FBF8E / #173626 | 8.31 on white; 5.86 on successBg |
| brick / errorBg | #F08A7E / #3B1D1A | 7.70 on white; 6.28 on errorBg |
| warnText / warnBg | #E8B45F / #3A2A12 | 7.32 |
| infoBg | #17263D | jellyDeep on it 6.66 |
| border (decorative dividers) | #3A3A3F | |
| fieldBorder | #707077 | 3.81 on white, 4.00 on paper |
| jelly, auroraAmber, auroraTeal | unchanged | never text |

## Shape, shadow and gradient tokens (Final set, Jeun 2026-11-05)

| Token | Value | Use |
|---|---|---|
| radius pill | 9999px (`rounded-full`) | Primary button 48h, field 60h, aurora and disabled 50h, badges |
| radius surface | 24px | Card, EmptyState, LoadingState |
| radius banner | 28px | Error and info banners |
| radius card | 8px | Final CTA ink band |
| shadow-field | inset 0 1px 0 white/90%, 0 10px 26px jellyDeep/12% | Domain field, info banner |
| shadow-button | inset 0 1px 0 white/25%, 0 6px 14px jellyDeep/30% | Primary button |
| shadow-card | inset 0 1px 0 white/90%, 0 16px 40px jellyDeep/10% | Card |
| shadow-banner-error | inset 0 1px 0 white/90%, 0 10px 26px brick/12% | Error banner |
| shadow-aurora | 0 8px 22px jelly/18%, 0 4px 14px auroraAmber/12% | Aurora button |
| shadow-track | inset 0 1px 2px ink/6% | Progress track |
| shadow-fill | 0 2px 6px jellyDeep/25% | Progress fill |
| aurora | linear-gradient(90deg, auroraAmber, auroraTeal, jelly), 2px ring | Google sign-in button only. The only gradient |

## Type

| Role | Font | Size / line (mobile -> md+) |
|---|---|---|
| Display (hero H1) | Fraunces 600 | 40/44 -> 56/60 |
| H2 | Fraunces 600 | 28/34 -> 36/42 |
| H3 / card title | Fraunces 600 | 20/26 |
| Hero number | Fraunces 600, tabular | 48/52 |
| Body | Public Sans 400 | 16/24 |
| Body large | Public Sans 400 | 18/28 |
| UI / button | Public Sans 600 | 15/20 |
| Caption | Public Sans 400 | 13/18 |
| Micro (audit credit) | Public Sans 400 | 10/14 |
| Header wordmark 'Rank1' | Fraunces 600, ink | 18 |

## Components

| Component | Spec | Source |
|---|---|---|
| Button primary | Pill, jellyDeep bg, white text, 48h, padding 0 20, shadow-button, hover darken 8%, focus 2px jellyDeep ring offset 2. Loading: jellyLoading bg + white spinner + label ('Checking…'). One per screen. | (Final set, Jeun 2026-11-05) |
| Button secondary | Text link, jellyDeep 600, → arrow after the label, underline on hover, 44px tap area. Banner actions use it. | (Final set, Jeun 2026-11-05) |
| Button disabled | Real `<button disabled>`: pill 50h, white/55% fill, 1.5px ink/14% edge, inkMuted label at 75% opacity, 14px lock icon after it. | (Final set, Jeun 2026-11-05) |
| Field + Button (DomainField) | Pill field 60h, white, 1px fieldBorder, shadow-field, padding 6 6 6 20, 18px globe icon, labeled input (15px), primary button inside on the right. Focused: 2px jellyDeep edge. Loading: button loading. Error: 2px brick edge + brick 13px error text below, tied with aria-describedby. When the field is narrower than 21rem (phones, small cards) the button drops below the input, full width, and the field radius becomes 28 so the domain stays readable. | (Final set, Jeun 2026-11-05) |
| Aurora button | Pill 50h, white, 2px aurora ring, shadow-aurora, jellyDeep 16px spinner + jellyDeep label. Google sign-in only. | (Final set, Jeun 2026-11-05) |
| Final CTA | Full-width ink band, paper text; amber button, ink text. | PAGE |
| Card | White surface on the paper page, radius 24, shadow-card, no border, padding 24 (16 mobile). | (Final set, Jeun 2026-11-05) |
| Badge | Pill 999px, caption size; success/error/warn/info fills. | ADOPTED |
| Table | Header Public Sans 600 13px inkMuted; 1px ink/15% dividers; numbers right-aligned, tabular. Leaderboard: max 3 numbers per row; sample size under table. | PAGE + ADOPTED |
| Chart | Lines and bars only. In-app business line jellyDeep 2px; rival average ink 40% dashed 4/3; reports use the business color. No donut/Sankey/gauge/heatmap. | PAGE + ADOPTED |
| Freshness | 16px clock icon + caption inkMuted: 'Checked 14 h ago · 250 answers · API-measured, directional'. | PAGE + this pack; icon (Final set, Jeun 2026-11-05) |
| Error banner | White, 1.5px brick edge, radius 28, shadow-banner-error, 64px worried Jelly, one brick 600 sentence + one fix action as a secondary text link on the right. | (Final set, Jeun 2026-11-05) |
| Info banner | White, 1.5px jellyDeep edge, radius 28, shadow-field, 36px infoBg circle with an 18px jellyDeep 'i' icon, jellyDeep text. | (Final set, Jeun 2026-11-05) |
| Empty | Card, 80px Jelly, centered body-large message, DomainField ('yoursite.com' / 'Add my business'). | (Final set, Jeun 2026-11-05) |
| Loading + progress bar | Card, squishing 80px Jelly, 16px jellyDeep spinner + message, 12px track (white, 1px border, shadow-track) with a jellyDeep fill (shadow-fill), 'n of d answers' inkMuted left and the floored percent jellyDeep 600 right. The percent is computed. Reduced motion stops the spinner and the squish. | (Final set, Jeun 2026-11-05) |
| Logo | Bar mark (public/logo-mark.svg, currentColor, ink) left of the wordmark 'Rank1' in Fraunces 600 18px ink, 8px gap. App icon: public/app-icon.svg. | Jeun 2026-11-05 |
| Spacing | 4-pt: 4 8 12 16 24 32 48 64 96. Sections 96 / 64 mobile. Max width 1120. Gutters 20 mobile / 32 desktop. | ADOPTED |
| Breakpoints | sm 640, md 768, lg 1024 (container cap 1120). Stack below md. Tap targets >= 44px. Sticky mobile CTA bar. | PAGE |

## Jelly

| Jelly | Rule |
|---|---|
| Asset | Interim /public/jelly.png from jelly-01-front.jpg; remove the #F5F5F5 background (build task, step 2). Swap to jelly.svg when a vector exists. |
| Rules | One Jelly per screen. Never recolored. No mouth, limbs, props or text. Expressions are eyes only: neutral, happy, worried, looking, sleepy. |
| Hero | 160-200px beside the sample card, eyes toward '34%'. |
| Empty | 64-96px, eyes toward the button. |
| Loading | Squish scaleY 0.95 -> 1.0, ~1.2 s loop with a blink; static under prefers-reduced-motion. |
| Error | 64px worried, inside the errorBg banner (ADOPTED). |
| Favicon | The bar app icon: ink #1E2320 rounded square, three paper #F7F4EE bars (src/app/icon.svg, drawn on a 32 grid so it stays sharp at 16 and 32; apple-icon.png 180). (changed by Jeun 2026-11-05) |
| Footer credit | 12px flat Jelly + 'Powered by Rank1' (10px) ONLY on the free audit. Never on $99 plan reports. |
| Alt | "Jelly, the Rank1 mascot: a glossy blue gummy blob with two oval eyes"; repeats alt="". |

# 4a. Landing page (rank1.us), exact copy

9 sections in order.

| Section | Exact copy | Notes |
|---|---|---|
| 1 Hero | H1 "Be the brand AI names first." Sub "See how often ChatGPT, Gemini, Google AI Overview and Perplexity name your business, how you stack up against competitors, and what to fix next." Primary "Get my free audit" (-> #audit). Text link "See pricing". Micro "Same-day results as CSV + PNG. No card." Right: card "Example data: named in 34% of 160 answers, +6 pts" + Jelly. | 2 cols, stack < md |
| 2 Social proof | "Built for businesses that want AI to name them." 4-5 [PLACEHOLDER LOGO] + 1 [PLACEHOLDER TESTIMONIAL - real, with permission]. Hidden: SHOW_SOCIAL_PROOF=false. | Hidden until real |
| 3 Problem / how it works | H2 "Customers ask AI who to pick. Find out if it names you." Brick 'Before' card: "Pasting questions into 4 chatbots by hand and logging answers in a spreadsheet." Steps: 1 "Add your domain - Rank1 suggests questions. 5-minute setup." 2 "Rank1 checks 4 AI engines every week." 3 "You get a monthly report with GA4 traffic, competitor scores and what to fix next." CTA "Get my free audit". | DECIDED: monthly report, weekly checks (Proposals #6) |
| 4 Features (3 cards) | "One dashboard": visibility % with sample size, change since last week's check, competitor leaderboard, every weekly check kept in History. "Reports that send themselves": monthly, white-label with your logo, GA4 traffic, competitor scores, what to fix next; no 'Powered by Rank1' on the $99 plan. "Set up in 5 minutes": auto-suggested questions. Small moss and amber icons. | DECIDED: monthly report, weekly checks |
| 5 Screenshots | H2 "What you see on Monday." Tabs: Dashboard · Monthly report · Audit CSV; 1px ink border; label "Example data". CTA "Get my free audit". | Tablist, arrow keys |
| 6 Comparison | H2 "Built for one business, not 500 brands." Columns: Manual checks \| Enterprise AI trackers \| Rank1. Rows: Setup (hours \| sales call + onboarding \| 5 minutes); Competitor leaderboard (manual \| varies \| yes); White-label report (build it yourself \| varies \| yes); GA4 traffic in report (manual \| varies \| yes); Price for one business (your time \| enterprise pricing \| $99/mo self-serve). Footnote "Enterprise column is a general description, not a specific product." CTA "Start with a free audit". No competitor names. | Mobile: scroll, Rank1 column pinned |
| 7 Pricing | H2 "One plan. One business." "$99/mo, self-serve, for 1 business." Includes: 4 AI engines; 25 questions checked every week; one dashboard; competitor leaderboard; white-label monthly report with GA4 link + what to fix next; no 'Powered by Rank1' credit. CTA "Start for $99/mo"; secondary "Get my free audit first". Under the card: "Agency? $99 per business, white-label included. Contact us." Second line: "Want us to do the work for you? Contact us." | '25 questions' + done-for-you line added from locked plan |
| 8 FAQ | Which AI engines? (ChatGPT, Gemini, Google AI Overview, Perplexity) / What does visibility % mean? (the share of answers where AI names your business, always shown with the sample size) / How long is setup? (about 5 minutes) / Can I white-label? (yes; the $99 plan includes white-label reports with your own logo and no Rank1 credit) / Do I need GA4? (optional; adds traffic to the report) / What's in the free audit? (same-day CSV + PNG) / Why do results change week to week? (AI answers vary between runs, so we ask each question several times and show how many answers each number is based on) | details/summary; last Q added (Validator: directional) |
| 9 Final CTA (#audit) | Ink band, paper text. H2 "Find out if AI names your business first." Sub "Free same-day audit as CSV and PNG (includes a small 'Powered by Rank1' credit)." Form: email + your domain; amber button, ink text "Get my free audit". Jelly right, eyes up (hidden on mobile). | Turnstile + honeypot |
| Footer / meta | Footer: Rank1, Pricing, FAQ, Contact us, Privacy, Terms. Meta title "Rank1 - Be the brand AI names first."; description = hero sub; OG image [PLACEHOLDER]. | Contact email shown as the form, not an address |

- Mobile: hero and cards stack below md; comparison scrolls with the Rank1 column pinned; sticky bottom 'Get my free audit' bar after the hero; final-CTA Jelly hidden.
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
| Where | App header, left of the account menu: 'Example Ramen House ▾'. Hidden when the workspace has 1 business (shows the name only) until an agency adds a 2nd. |
| List | Each business: name, city, visibility % with n ('34% · 250 answers'), status dot (moss active, brick paused). Max height 360, search when > 8. |
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
