-- Reverts 20261105000032_ai_access_pending.sql.
drop function if exists public.runs_needing_ai_access_check(int);
