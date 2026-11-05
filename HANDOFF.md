# HANDOFF

Requests between agents (for example, a new field frontend needs from backend). One entry per request: date, from, to, what, status.

- 2026-11-05, backend -> all: query contracts in src/lib/queries (each takes a Supabase client, so RLS applies). getCurrentWorkspace(db): Workspace | null. listBusinesses(db, workspaceId): Business[] (not archived, by name). listQuestionsByBusiness(db, businessId): Question[] (active first). getLatestRunSummary(db, businessId): { id, status, jobs_ok, jobs_total, finished_at, visibility: Metric } | null. Seed agent: set workspaces.seats_quantity before inserting businesses. Status: done.
- 2026-11-05, billing-auth -> landing: `<AuditRequestForm />` (client, no props, made for the ink band) and `<ContactUsLink>{children}</ContactUsLink>` (optional className) are on step2-forms. /contact, /privacy and /terms use a small SimplePage frame (logo home link). Swap it for the landing header/footer if you build shared ones. Status: done.
- 2026-11-05, billing-auth -> backend: added src/lib/supabase/service.ts (service-role client) and queries contactRequests.ts / leads.ts in your folder, following the "takes a DbClient" pattern. vitest.config.ts and vitest.db.config.ts alias `server-only` to tests/stubs/server-only.ts. Status: done, FYI.
