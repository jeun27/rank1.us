# G2 "Can AI see your site?" (data-pipeline, branch feat/gas-ai-access)

Built from briefs/rank1-gas.md (G2) + the lead's OK on the design note (2026-11-06). Behind ENABLE_AI_ACCESS_CHECK.

## Lead decisions (2026-11-06)
- The SSRF guard is mandatory: http(s) only, public IPs only (re-checked after DNS and every redirect), ≤3 redirects, 5 s, 512 KB, no cookies, counts-only logs.
- Store all 6 crawlers + the visible-word count. The UI shows "{n} of 6 AI crawlers can read your site" (Q1).
- R10 and R14 are unchanged (Q2). R14 deliberately covers only the search/answer bots: blocking training bots can be a legitimate choice, so the G2 panel shows those as info. Fixes from G2: R16 (Cloudflare hint, migration 0025) and the new R18 "Your homepage needs JavaScript to show its text" (p5, backend's 0031).
- F1: read-site.ts moves onto the same guard in this PR (it had a DNS rebinding window).

## Changed
- src/lib/site/guarded-get.ts: the one guarded GET for other people's sites.
  - DNS is resolved inside the socket's own lookup, and the connection goes only to the checked address (every record public). The connected remote address is checked again.
  - Ports 80/443, no userinfo, no proxy or keep-alive pool. Cookie/Authorization are never sent and Set-Cookie is dropped.
  - Each redirect is validated from scratch. A test-only allow/ports/transport seam lets tests use a local server; production uses the defaults.
- src/lib/site/address.ts: isPrivateAddress moved here from read-site.ts (re-exported there).
- src/lib/onboarding/read-site.ts: reads only through guardedGet (its own lookup cache, redirect loop and size reader are gone). It keeps its 1 MB cap, 10 s timeout and same-site redirects. robotsDecision returns the deciding robots.txt line, and robotsAllows wraps it.
- src/lib/site/ai-access.ts: checkAiAccess(domain) → robots.txt for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot and Google-Extended on "/" (with the deciding line), visible words with JS off, the homepage requested once as GPTBot vs our UA, and the Cloudflare hint (cf-ray or server: cloudflare). At most 3 requests, under one 15 s deadline for the whole check (every hop gets only what's left).
  - The GPTBot request (maintainer OK, 2026-11-06) goes to the homepage only, once, with an honest UA: "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot) Rank1-AccessCheck/1.0 (+https://rank1.us)". Bot managers block unverified GPTBot UAs, so a 401/403/406/429/503 or a challenge page there is only a soft "may be blocked at the edge" hint, shown with the Cloudflare hint (outcome 'cloudflare'). A definite 'blocked' comes from robots.txt alone. The UI copy must say "may be blocked" for it.
  - Outcome: blocked (robots.txt) > js_empty (< 50 words) > cloudflare (the Cloudflare or edge hint) > good, or unreachable.
- Paid runs: the per-run fix pass (checkFixesWith) runs the check, stores it (record_ai_access_check), and adds R16/R18 to the same record_fix_results call. That RPC returns early on a second call for a run, so G2 can't record separately. R10 and R14 keep their Step 10 rules.
- R16 (src/lib/fixes/r16-cloudflare.ts): fix when Cloudflare is in front and robots.txt lets every AI crawler in.
- R18 (src/lib/fixes/r18-js-empty.ts): fix when the homepage has under 50 visible words with JavaScript off, decided by the word count alone. Both are unchecked without a site or when it's unreachable, and each is evaluated only when its fix_rules row is enabled.
- Free audits (no business, so no fixes): the run-jobs hook checkFreeAuditAccessWith stores the check for ≤1 free audit per tick (backend's runs_needing_ai_access_check, the last 7 days), with ≥30 s left. It runs after notify and before the fix pass. If the check itself throws, an 'unreachable' row is still recorded, with a short error code (backend's ai_access_checks.error: [A-Za-z0-9_] ≤ 40, else "error"), so the run leaves the oldest-first queue (#116 reviewer S1). Unreachable sites also store the guard's reason (timeout, blocked_address, …), http_<status>, or bad_domain.
- Test change, with reason: rules.test.ts checked every COPY template against the seed, but R16 and R18 are inserted by migrations (0025, 0031), not the seed. They're checked verbatim against those migrations instead, and the other rules are unchanged.

## Step 18 cleanup (lead, 2026-11-06)
- Revoking a Google account in Rank1 revokes it for every Rank1 business using that account (others self-heal to needs_reauth). Decide copy or per-business tokens.
