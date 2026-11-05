# HANDOFF

Requests between agents (for example, a new field frontend needs from backend). One entry per request: date, from, to, what, status.

- 2026-11-05, backend -> all: query contracts in src/lib/queries (each takes a Supabase client, so RLS applies). getCurrentWorkspace(db): Workspace | null. listBusinesses(db, workspaceId): Business[] (not archived, by name). listQuestionsByBusiness(db, businessId): Question[] (active first). getLatestRunSummary(db, businessId): { id, status, jobs_ok, jobs_total, finished_at, visibility: Metric } | null. Seed agent: set workspaces.seats_quantity before inserting businesses. Status: done.
