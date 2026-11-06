# G2 free audits needing a check (backend) (branch feat/ai-access-pending)
- data-pipeline's request (G2): free audits need a way to be picked up for the AI access check; paid runs ride the existing fix pass.
- Migration 20261105000032 (+ .down.sql): runs_needing_ai_access_check(limit) (service only) returns complete/partial free_audit runs started in the last 7 days (old audits never backfill) with no ai_access_checks row, oldest first, at most 100. The domain is free_audits.domain (the canonical snapshot domain).
- Query: listRunsNeedingAiAccess(serviceDb, limit) in src/lib/queries/ai-access.ts.
- Reviewer S1: a failed free-audit check must still record a row so it leaves the list. 0032 adds ai_access_checks.error (null, a short code like timeout, blocked_address, error or a PG code; ≤ 40 characters of [A-Za-z0-9_], never message text) and redefines record_ai_access_check to accept p.error (22023 otherwise). AiAccessInput gains errorCode; AiAccessCheck gains error.
