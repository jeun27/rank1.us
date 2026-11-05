# COPY

Every customer-facing string Rank1 may use, copied verbatim from build pack section 4 (docs/UI.md). Do not write new copy. Safe claim wording and the DO NOT USE list are in docs/AEO.md.

## Shared components (from section 4, Components and Jelly)

| Component | Spec | Source |
|---|---|---|
| Freshness | Caption inkMuted: 'Checked 14 h ago · 250 answers · API-measured, directional'. | PAGE + this pack |
| Error banner | White, 1.5px brick edge, 64px worried Jelly, one brick sentence + one fix action as a text link. | (Final set, Jeun 2026-11-05) |

### Final set strings (Final set, Jeun 2026-11-05)

| Where | String |
|---|---|
| Field + Button placeholder (landing) | "yourbusiness.com" |
| Field + Button placeholder (empty state) | "yoursite.com" |
| Field + Button loading label | "Checking…" |
| Field + Button error (no ending) | "Add the ending, like ramenhouse.com" |
| Disabled pill | "Add business" (disabled) |
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
| Account menu label and item | "Account", "Sign out" |
| Landing header link to /signin | "Log in" |
| /app/billing paywall stub: Pricing card copy, "Start for $99/mo" disabled, caption | "Checkout isn't open yet." |
| Placeholder H1s | /app/onboarding "Add your business", /app "Dashboard", /client "Dashboard", /app/billing "Billing" |

| Jelly | Rule |
|---|---|
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

- **{dietary}**: vegan, vegetarian, gluten-free, halal, kosher
- **{occasion}**: date night, birthday, business lunch, large group
- **{landmark}, {area}**: from local_places for the business's city (max 3 each picked in onboarding)
- **Max per business**: 25 active questions
