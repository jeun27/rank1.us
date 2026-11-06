## G2 (frontend): "Can AI see your site?" (branch feat/gas-ai-access-ui)

- Lead OK 2026-11-06 for D1, D3, D4 and D6. Q1: the strings are lead copy (COPY.md "GAS"). Q2: split search vs training as in D3. Q3/Q4: no separate dashboard card. D5: switch to `stack` when PR4 lands. Everything is behind ENABLE_AI_ACCESS_CHECK. No backend changes.
- The answer (src/components/audit/ai-access.ts, `aiAccessAnswer`), by outcome:
  - good → "AI can read your site."
  - blocked, with an R14 search bot blocked (OAI-SearchBot or PerplexityBot; SEARCH_BOTS is tested equal to FIX_BOTS) → the error line naming them.
  - blocked, only other crawlers → info, "the owner's call".
  - js_empty → the R18 copy.
  - cloudflare with a GPTBot-request block status (401/403/406/429/503) → the edge hint ("may be blocking"). Otherwise → the R16 title, with the R16 customer copy as the hint.
  - unreachable → "We couldn't reach {domain}." The domain shows only when it's a hostname, since it can be raw input.
- The panel (AiAccessPanel): the answer first, "{n} of 6 AI crawlers can read your site", the crawler table (Allowed/Blocked and the deciding robots.txt line, or "No rule"), the JavaScript-off word count, and "Checked {age} ago". Blocked R14 bots are the error tone, and other blocked crawlers are info. Unreachable is one line with no table.
- Where it shows:
  - /audit: below the leaderboard (U6). loadFreeAudit reads getAiAccessCheck with the service client, only with the flag on.
  - What to fix next: the panel is the `evidence` on R14/R16/R18 open rows (FixView.evidence, a new slot). There the crawlers stack as a list, because the table doesn't fit a phone-width fix row.
  - /app dashboard: one quiet "AI can read your site · checked {age} ago" line under the hero, only when the outcome is good (Dashboard `reassure` slot). Problems are P5 fixes, which the next-fix card already leads with.
- Not done: the /client fix list gets no evidence yet, and the paid run page (/app/runs) shows no panel. The lead scoped G2 to /audit and What to fix next.
