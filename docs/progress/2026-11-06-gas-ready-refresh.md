# G3 GAS readiness refresh (data-pipeline, branch feat/gas-ready-refresh)

Built from briefs/rank1-gas.md (G3) + the lead's note that nothing called refresh_gas_ready (found by frontend's #124). Behind ENABLE_CONNECTIONS: every Connections entry point already returns "disabled" with the flag off.

## Changed
- src/lib/connections/readiness.ts: refreshReadiness(businessId) reads the business's vertical and calls backend's refresh_gas_ready with readinessSet(vertical) (Recommended ∩ live). When newly_ready and TEAM_NOTIFY_EMAIL is set, it sends one team email via Resend. The idempotency key is per business and day, and the sender is CONTACT_FROM_EMAIL. TEAM_NOTIFY_EMAIL is unset today, so nothing is sent. It never throws (a readiness hiccup must not undo a connect or revoke), and logs carry the PG code only.
- The email uses only approved strings (the GAS team notice): subject "{Business} is ready for GAS", body "{connections} connected." + "Start on the fix list: {site}/team".
- Called after every connection change in src/lib/connections/service.ts: a successful connect (save_connection), revoke (revoke_connection), a token-refresh failure that marks needs_reauth, and a 401 while applying a GBP edit (needs_reauth). Not after a denied connect or a failed Google revoke, since nothing changed.
- tests/db/free-audit-retry-row.test.ts (G2 follow-up, lead): the free-audit hook against the real record_ai_access_check. A bad domain is recorded unreachable (bad_domain), and a refused first record falls back to the minimal row (record_failed). Both leave runs_needing_ai_access_check.
