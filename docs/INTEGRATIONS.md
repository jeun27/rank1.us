# INTEGRATIONS

From build pack section 5 (external APIs, env vars, GA4 AI channel). Read the official docs before any call; confirm every UNVERIFIED item first.

## Integrations

| Integration | Endpoint / call | Status |
|---|---|---|
| ChatGPT (DataForSEO) | POST https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced  {keyword, location_code: 2840, language_code: 'en', force_web_search: true} | VERIFIED (team, Nov 4). Response field names: confirm in docs. task_post mode for weekly: UNVERIFIED |
| Gemini (DataForSEO) | POST https://api.dataforseo.com/v3/ai_optimization/gemini/llm_scraper/live/advanced | VERIFIED endpoint; city effect UNVERIFIED (treat as country) |
| Google AI Overview (DataForSEO) | POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced  {keyword, location_code\|location_name, load_async_ai_overview: true}; item type 'ai_overview' | VERIFIED (team). Country/state/city/zip |
| Locations (DataForSEO) | GET https://api.dataforseo.com/v3/serp/google/locations | VERIFIED |
| Local competitors (DataForSEO Maps) | POST https://api.dataforseo.com/v3/serp/google/maps/live/advanced  {keyword: '{cuisine} restaurant', location_name\|location_code\|location_coordinate, language_code, depth}; items type maps_search (title, domain, rating, category, cid) | Endpoint VERIFIED (docs page, Nov 4). Exact item field names + rating shape: confirm in docs |
| DataForSEO common | Basic auth DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD; status_code 20000 = OK; live tasks up to ~120 s -> 130 s timeout | VERIFIED (team) |
| Perplexity | POST https://api.perplexity.ai/v1/agent (Agent API, https://docs.perplexity.ai/api-reference/agent-post, read 2026-11-06; the code has used this path since #16)  tools: [{type: 'web_search', user_location: {country: 'US', region: 'California', city: 'Irvine'}}]; lat/long must be paired with country. Answer: output[] items of type message → content[].text; sources: output[] items of type search_results → results[{url, title}] | Endpoint, user_location and the response/source fields VERIFIED (docs). Model name and price: UNVERIFIED (live smoke 2026-11-06: 5/5 ok, ~$0.0043 each) |
| DataForSEO Business Data (GBP info, Google reviews, Yelp, TripAdvisor) | Used by R1-R7, R9, R15. Paths, field names and per-call price not checked | NOT in v1 (Jeun, Nov 4; see Later). Those checks use Maps SERP, organic SERP snippets and own site only; data only these endpoints give returns 'unknown' |
| Own-site fetch | Server GET of robots.txt, home, /menu, up to 20 pages; User-Agent names Rank1; respects robots.txt; 10 s timeout | No API |
| Supabase Auth | supabase.auth.signInWithOAuth({provider: 'google'}); @supabase/ssr for Next.js | VERIFIED (docs) |
| Stripe Checkout | Checkout Sessions create: mode 'subscription', line_items [{price, quantity}], client_reference_id | VERIFIED (docs) |
| Stripe quantity change | Subscriptions update: items[{id, quantity}], proration per Stripe default | VERIFIED (docs pages exist). Exact proration_behavior choice: confirm |
| Stripe portal + webhooks | Customer Portal sessions create; webhooks with signature (STRIPE_WEBHOOK_SECRET) | VERIFIED (docs). Event list in step 12: confirm names |
| GA4 Admin | GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries -> propertySummaries[].property 'properties/{id}' | VERIFIED |
| GA4 Data | POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport {dimensions, metrics, dateRanges}; scope analytics.readonly (sensitive: ~10 business days verification; 100-user cap until verified; no CASA) | VERIFIED (team) |
| Resend | POST https://api.resend.com/emails {from, to, subject, html} | VERIFIED (docs) |
| Turnstile | POST https://challenges.cloudflare.com/turnstile/v0/siteverify {secret, response, remoteip} | VERIFIED (docs, Nov 4) |
| Vercel | Cron Jobs (vercel.json crons, CRON_SECRET bearer); Queues; functions up to 800 s on Pro | VERIFIED (docs) |
| PNG / PDF | next/og ImageResponse for PNG; @react-pdf/renderer for PDF | Docs pages exist; version details: confirm |

## Env vars (.env.example)

DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, PERPLEXITY_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_BUSINESS, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY, RESEND_API_KEY, REPORT_FROM_EMAIL, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL, NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, CRON_SECRET, FOUNDER_EMAIL, AUDIT_DAILY_LIMIT, SHOW_SOCIAL_PROOF, NEXT_PUBLIC_SITE_URL

# 5c. GA4 AI channel

| Item | Detail |
|---|---|
| Channel name | AI (custom channel group), placed ABOVE Referral |
| Conditions (OR'd) | Rule A OR Rule B OR Rule C, all in one 'AI' channel |
| Rule A | Session source matches regex AI_RULE_A (below; 152 chars) |
| Rule B | Session source matches regex AI_RULE_B (below; 163 chars) |
| Rule C | Session source matches A or B AND session medium = (not set) (ChatGPT adds utm_source=chatgpt.com with no medium, which otherwise lands in Unassigned) |
| Full match | GA4 regex is full-match: https://support.google.com/analytics/answer/1034324 |
| Google's example | AI-assistants channel example: https://support.google.com/analytics/answer/13051316 |
| Length limit | Google doesn't document one; a 256-char limit is UNVERIFIED (community report), so keep each rule at 256 chars or fewer |
| Rules per group | Admin API: max 50 rules per channel group (https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1alpha/properties.channelGroups) |
| Live test | Not yet tested in a live GA4 property: Step 13 has a regex unit test against sample sources plus a manual GA4 check |
| Caveat: floor | Much AI traffic shows up as Direct, so this is a minimum. |
| Caveat: AI Overviews | Clicks from Google AI Overviews count as Organic Search. |
| Report footnote | AI visibility is not the same as GA4 AI sessions. |
| No promises | No traffic promises anywhere. |
| Regex sanity check | Checked in Node (not GA4): chatgpt.com, www.perplexity.ai, perplexity, grok.com, chat.deepseek.com, chat.mistral.ai match; google, notchatgpt.com, perplexityxai.com don't. le.mistral.ai no longer matches (B allows only chat. before mistral.ai). openai.com, anthropic.com, x.ai, huggingface.co may overcount non-chat visits. |
| Source | Swydo, Mar 2026: https://www.swydo.com/blog/track-ai-traffic-in-ga4/ |

AI_RULE_A:

```
^(?:www\.)?(?:chatgpt\.com|chat\.openai\.com|openai\.com|perplexity(?:\.ai)?|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai|grok\.com|meta\.ai)$
```

AI_RULE_B:

```
^(?:www\.)?(?:anthropic\.com|you\.com|phind\.com|(?:chat\.)?deepseek\.com|x\.ai|grok\.x\.com|poe\.com|(?:chat\.)?mistral\.ai|character\.ai|pi\.ai|huggingface\.co)$
```
