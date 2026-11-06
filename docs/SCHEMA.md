# SCHEMA

From build pack section 5 (tables, metrics, fix_rules seed).

Postgres on Supabase, RLS on every table via workspace_members.

| Table | Columns | RLS |
|---|---|---|
| workspaces | id, name, owner_id, stripe_customer_id, stripe_subscription_id, subscription_status, seats_quantity int default 0, created_at | members read; owner updates; billing fields service-role only |
| workspace_members | workspace_id, user_id, role ('owner'\|'member'), created_at | member reads own workspace; owner manages |
| businesses | id, workspace_id, name, domain, aliases text[], vertical default 'restaurant' (the industry: restaurant, hvac, plumbing, roofing, pest_control, auto, beauty, gym, events, dental, saas, dtc, other), cuisine, city default 'Irvine', state default 'CA', country default 'US', brand_color, logo_path, report_recipients text[], ga4_property_id, archived_at | by membership; insert blocked if active count >= seats_quantity (trigger/RPC) |
| competitors | id, business_id, name, domain, aliases text[], source ('maps'\|'manual'\|'suggested'), maps_cid, rating, hidden bool | by membership |
| questions | id, business_id, short_text, long_text, active_form ('short'\|'long'), active bool, location_level ('country'\|'state'\|'city'), country, state, city, dfs_location_code, template_key | by membership; <= 25 active per business (trigger) |
| runs | id, business_id, kind ('audit'\|'weekly'\|'free_audit'), status ('queued'\|'running'\|'partial'\|'complete'\|'failed'), jobs_total, jobs_ok, jobs_failed, cost_usd, started_at, finished_at | read by membership; write service-role |
| answers | id, run_id, question_id, engine ('chatgpt'\|'gemini'\|'google_aio'\|'perplexity'), run_index 1-3, status ('ok'\|'failed'\|'no_overview'), text, question_text_used, location_used, location_supported ('exact'\|'fallback_country'), mentioned bool, first_position int, brands jsonb, cost_usd, raw jsonb, checked_at | read by membership; write service-role |
| citations | id, answer_id, url, domain, title, position, category | read by membership; write service-role |
| domain_categories | domain, category ('reddit'\|'youtube'\|'social'\|'review_directory'\|'news_blog'\|'other'), source ('rule'\|'manual') | read all signed-in; write founder |
| fix_rules | key text pk ('A1'-'A6','R1'-'R15','H1'), grp ('answers'\|'restaurant'\|'hygiene'), title, size ('S'\|'S-M'\|'M'\|'M-L'\|'L'), detection, data_source, cadence ('weekly'\|'monthly'), threshold jsonb, unverified text[], customer_copy, why_note (engineer-only), ai_lever bool (false for H1), enabled bool | service-role only; app reads view fix_rules_public (no why_note) |
| question_templates | id, vertical ('restaurant'), short_form, long_form, slots text[], fixed_cuisine text null, fixed_city text null, origin, sort | read: authenticated; write: service role |
| local_places | id, city, state, name, kind ('landmark'\|'area'), verified bool | read: authenticated; write: service role |
| listing_snapshots | id, business_id, source ('gbp'\|'yelp'\|'tripadvisor'\|'booking'\|'site'\|'serp'), url, data jsonb, fetched_at | read by membership; write service role |
| fixes | id, business_id, rule_key (fk fix_rules.key), size, title, detail, evidence jsonb, affected_answers int, status ('todo'\|'doing'\|'done'), first_seen_run, last_seen_run | by membership |
| experiments | id, business_id, fix_id null, name, change_note, change_url, change_date, status | by membership |
| experiment_questions | experiment_id, question_id, grp ('test'\|'control') | by membership; unique(experiment_id, question_id) |
| google_tokens | business_id, refresh_token_enc, scope, created_at | service-role only (no policies for anon/auth) |
| ai_traffic | business_id, date, source, sessions | read by membership; write service-role |
| connections | id, business_id, provider (gbp, search_console, ga4, shopify), status (connected, needs_reauth, revoked), external_account_id, selected_entities jsonb, scopes text[], connected_by, connected_at, last_checked_at; unique (business_id, provider) | read: members (incl. the dfy_client) and the team on DFY; write: service RPCs only |
| connection_tokens | connection_id, enc_access, enc_refresh, expires_at (AES-GCM ciphertext) | service-role only (no policies) |
| connection_changes | id, connection_id, business_id, actor, field, before jsonb, after jsonb, provider_ref, created_at | read like connections; append-only (service RPC insert, gbp field allowlist) |
| connector_interest | business_id, provider (12 connector keys), user_id, created_at | read like connections; write: note_connector_interest |
| reports | id, business_id, period_start, period_end, pdf_path, sent_to text[], sent_at, status | by membership |
| leads | id, email, domain, run_id, token, ip_hash, created_at | service-role only |
| contact_requests | id, name, email, company, tier, message, ip_hash, user_agent, emailed bool, created_at | service-role only |
| stripe_events | event_id pk, type, processed_at | service-role only (idempotency) |

- **Visibility %**: answers naming the business / successful answers (failed + no_overview excluded)
- **Share of voice**: business mentions / all tracked-brand mentions in the same answers
- **Leaderboard**: each tracked brand's visibility % on the same answers, change vs last run
- **Sample per week**: 25 questions x 10 answers = 250 per location
- **Data cost (estimate)**: ~$2.51/mo per $99 business (team estimate; Perplexity Agent API price UNVERIFIED)

# 5b. What to fix next: restaurant checks (fix_rules seed)

UNVERIFIED rules seed disabled. DataForSEO Business Data sources are NOT in v1. The why column is engineer-only, never shown to customers.

| Key | Check | Size | How Rank1 detects it | Data source | Customer copy (exact) | Engineer why (never shown) |
|---|---|---|---|---|---|---|
| R1 | Complete Google Business Profile (categories, hours, attributes, website) | S | Compare profile fields to a checklist (primary + extra categories, hours, website, phone, attributes); diff weekly snapshots; list missing fields. | DataForSEO Maps SERP item (VERIFIED endpoint; field names UNVERIFIED) + DataForSEO Business Data Google My Business info (endpoint UNVERIFIED) | Your Google Business Profile is missing: {fields}. | BrightLocal Aug 2026: GBP = 45.2% of restaurant AI citations. Yext: listings 41.6% for food service. |
| R2 | GBP menu link goes to an HTML menu | S-M | Read the menu link field, fetch the URL, classify: HTML with dish text vs PDF / image / none. | GBP data as R1 (menu field UNVERIFIED) + our own fetch | Your Google menu link opens a {PDF/image}. Link a menu page with the dishes written as text. | Growth input; no lift study. Text menus are readable by crawlers. |
| R3 | GBP photo count and recency | S | Count photos by type and the newest photo's age; fix if under threshold. | GBP data as R1 (photo fields UNVERIFIED). Threshold UNVERIFIED (seeded disabled) | Your newest Google photo is {n} months old. | Growth input; threshold UNVERIFIED. |
| R4 | Rating, review count, recency | M | Flag rating < 4.0 or no new review in {days} days (days UNVERIFIED, config). Never promise an outcome. | Maps SERP rating + review count; last review date via DataForSEO Google Reviews (UNVERIFIED) | Your Google rating is {r} from {n} reviews; the latest review is {d} old. | SOCi LVI 2026: recommended locations average ~4.2-4.3 stars (vendor, correlation). Never 'reach 4.3 and get cited'. |
| R5 | Owner replies to reviews | S-M | Over the last 50 reviews: reply rate, median reply lag, unanswered reviews of 3 stars or less. | DataForSEO Google Reviews (owner-reply field UNVERIFIED) | {x} of your last {n} Google reviews have no reply, including {k} of 3 stars or less. | SOCi: ~47% of Google reviews get a reply. |
| R6 | Claimed, consistent Yelp listing | M | Find the listing by name + address + phone; check claimed; diff fields vs GBP. | DataForSEO organic SERP 'site:yelp.com {name} {city}' (site: in keyword UNVERIFIED) + DataForSEO Business Data Yelp (UNVERIFIED). Claimed = unknown if not available | Your Yelp listing {is missing \| differs from Google on: fields}. | BrightLocal Aug 2026: Yelp 21.8% of restaurant AI citations; ChatGPT's top restaurant source. |
| R7 | TripAdvisor present and consistent | M | Presence + name/address/phone/hours diff vs GBP. | Organic SERP 'site:tripadvisor.com {name} {city}' + DataForSEO Business Data TripAdvisor (UNVERIFIED) | Your TripAdvisor listing {is missing \| differs from Google on: fields}. | BrightLocal Aug 2026: TripAdvisor 7.0%. |
| R8 | OpenTable/Resy profile (only if they take bookings) | M | Detect opentable.com / resy.com links on the site or GBP; else skip. Check name/address match. | Our own fetch + organic SERP site: search | Your {OpenTable/Resy} page differs from Google on: {fields}. | BrightLocal Aug 2026: OpenTable 6.6%. Resy share UNVERIFIED. |
| R9 | NAP consistency (GBP, Yelp, site, Facebook, Apple Maps) | M | Normalize name/address/phone (case, punctuation, suite forms, E.164 phone); report mismatches by severity (phone/address high, name medium, suite low). | listing_snapshots from R1/R6/R7 + own site + SERP snippets for facebook.com and maps.apple.com (Facebook/Apple coverage UNVERIFIED) | Your {field} differs across: {sources}. | SOCi: profile accuracy ~68%. |
| R10 | Crawlable HTML menu on your own site | M-L | Fetch home, follow /menu or a 'menu' link; flag PDF/image-only or no dish text. | Our own fetch | Your menu is a {PDF/image}; there's no menu page with the dishes as text. | Growth input; no lift study. |
| R11 | Dish-level pages / FAQ blocks (signature dishes, dietary tags) | L | Compare menu dish names and dietary tags (from R10) to site H1-H3 + FAQ text (max 20 pages, robots respected). | Our own crawl | These dishes have no section or page of their own: {dishes}. | No proven lift (Q&A blocks are on DO NOT USE as proven). Suggestion only. |
| R12 | Presence in OC/Irvine 'best of' coverage | L | Monthly: for each outlet in config (Eater LA OC/UCI maps la.eater.com, The Infatuation theinfatuation.com, OC Register ocregister.com; domains UNVERIFIED), 1 organic SERP call '"{name}" site:{domain}', depth 10; hit = normalized name in title/snippet/URL plus Irvine or the business city. Also free: any stored AI-answer citation URL on those domains that names the business. No hit anywhere = fix. | DataForSEO Google organic SERP (VERIFIED endpoint; site: in keyword UNVERIFIED) + stored citations. ~3 calls/business/month | We didn't find you in these local 'best of' lists that AI answers cite: {outlets}. | Lift UNVERIFIED; says 'we didn't find you', never that coverage raises visibility. |
| R13 | Reddit footprint (r/irvine, r/orangecounty) | M | Monthly: organic SERP '"{name}" site:reddit.com/r/irvine' and '... /r/orangecounty', depth 20; count distinct /comments/ thread URLs whose title/snippet names the business; same for the top 3 competitors; add Reddit URLs from stored citations. Fix when you have 0 and a competitor has 1+. | DataForSEO Google organic SERP + stored citations. ~8 calls/business/month | We found {n} Reddit threads naming you in r/irvine and r/orangecounty ({competitor}: {m}). | Lift UNVERIFIED. Never suggest fake posts or reviews. |
| R14 | robots.txt allows AI search crawlers | S | Parse robots.txt; flag Disallow on key paths (/, /menu) for OAI-SearchBot, PerplexityBot; report Google-Extended; GPTBot (training) = 'Your choice' info, not a fix. | Our own fetch; bot names per https://platform.openai.com/docs/bots | Your robots.txt blocks {bots} from {paths}. Check if you meant to. | No effect claim. Replaces old crawler rule 6. |
| R15 | Hours and holiday-hours accuracy | S | Diff hours (and special hours, field UNVERIFIED) across GBP, site, Yelp. | listing_snapshots (R1, R6) + own site | Your hours differ: Google says {a}, {source} says {b}. | Growth input. |
| H1 | Restaurant/Menu schema (hygiene only) | S | Check for Restaurant / Menu JSON-LD on the site. Shown under 'Tidy-ups'; never in top 5. | Our own fetch | Tidy-up: your site has no Restaurant/Menu structured data. This is housekeeping, not an AI visibility fix. | Ahrefs found no lift. Never sold as an AI lever. |
