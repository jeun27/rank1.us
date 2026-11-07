# Free audit for a business (backend, onboarding v2 BE2) (branch feat/free-audit-for-business)
- Migration 20261105000042 (+ .down.sql): free_audit_for_business(business) → { run_id, named, n, checked_at }, definer, members only (others get no row, anon 42501). Lead P4: an audit is the business's own only when its domain AND its lead email match the business's domain and the workspace owner's email (case-insensitive). Latest complete/partial only; named/n = its ok answers.
- Query: getFreeAuditForBusiness(db, businessId) in src/lib/queries/results.ts.
