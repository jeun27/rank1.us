# G2 free audits needing a check (backend) (branch feat/ai-access-pending)
- data-pipeline's request (G2): free audits need a way to be picked up for the AI access check; paid runs ride the existing fix pass.
- Migration 20261105000032 (+ .down.sql): runs_needing_ai_access_check(limit) (service only) returns complete/partial free_audit runs started in the last 7 days (old audits never backfill) with no ai_access_checks row, oldest first, at most 100. The domain is free_audits.domain (the canonical snapshot domain).
- Query: listRunsNeedingAiAccess(serviceDb, limit) in src/lib/queries/ai-access.ts.
