# Withdraw YouTube fixes (backend) (branch feat/withdraw-fixes)
- Lead-approved (follow-up to #152 S1, via data-pipeline): withdraw_fixes(business, rule_keys) for the weekly pass when a business isn't youtubeReady. Migration 20261105000037 (+ .down.sql): service role only; deletes only todo fixes of that business for R19-R21 (doing and done kept; an unstarted todo has no history); any other key or an empty list → 22023; returns the count. R16-R18 keep "ok → done".
- Query: withdrawFixes(serviceDb, businessId, ruleKeys) in src/lib/queries/fixes.ts.
