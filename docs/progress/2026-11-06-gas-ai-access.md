# G2 "Can AI see your site?" (data-pipeline, branch feat/gas-ai-access)

Built from briefs/rank1-gas.md (G2) + the lead's OK on the design note (2026-11-06). Behind ENABLE_AI_ACCESS_CHECK.

## Lead decisions (2026-11-06)
- The SSRF guard is mandatory: http(s) only, public IPs only (re-checked after DNS and every redirect), ≤3 redirects, 5 s, 512 KB, no cookies, counts-only logs.
- Store all 6 crawlers + the visible-word count. The UI shows "{n} of 6 AI crawlers can read your site" (Q1).
- No new rule keys: fixes use R14, R10 and R16 (R16 from migration 0025, p5).
- F1: read-site.ts moves onto the same guard in this PR (it had a DNS rebinding window).

## Changed
- src/lib/site/guarded-get.ts: the one guarded GET for other people's sites.
  - DNS is resolved inside the socket's own lookup, and the connection goes only to the checked address (every record public). The connected remote address is checked again.
  - Ports 80/443, no userinfo, no proxy or keep-alive pool. Cookie/Authorization are never sent and Set-Cookie is dropped.
  - Each redirect is validated from scratch. A test-only allow/ports/transport seam lets tests use a local server; production uses the defaults.
- src/lib/site/address.ts: isPrivateAddress moved here from read-site.ts (re-exported there).
- src/lib/onboarding/read-site.ts: reads only through guardedGet (its own lookup cache, redirect loop and size reader are gone). It keeps its 1 MB cap, 10 s timeout and same-site redirects. robotsDecision returns the deciding robots.txt line, and robotsAllows wraps it.
- src/lib/site/ai-access.ts: checkAiAccess(domain) → robots.txt for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot and Google-Extended on "/" (with the deciding line), visible words with JS off, the homepage as GPTBot vs our UA (401/403/406/429/503 or a challenge page = blocked), and the Cloudflare hint (cf-ray or server: cloudflare). At most 3 requests.
  - Outcome: blocked > js_empty (< 50 words) > cloudflare > good, or unreachable.
- Paid runs: the per-run fix pass (checkFixesWith) runs the check, stores it (record_ai_access_check), and adds R16 to the same record_fix_results call. That RPC returns early on a second call for a run, so G2 can't record separately. R10 and R14 keep their Step 10 rules.
- R16 (src/lib/fixes/r16-cloudflare.ts): fix when Cloudflare is in front and robots.txt lets every AI crawler in. Unchecked without a site or when it's unreachable.
- Test change, with reason: rules.test.ts checked every COPY template against the seed, but R16 is inserted by migration 0025, not the seed. R16 is now checked verbatim against the migration instead, and the other rules are unchanged.

## Step 18 cleanup (lead, 2026-11-06)
- Revoking a Google account in Rank1 revokes it for every Rank1 business using that account (others self-heal to needs_reauth). Decide copy or per-business tokens.
