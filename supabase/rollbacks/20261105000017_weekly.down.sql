-- Reverts 20261105000017_weekly.sql (runs it created stay).
drop function if exists public.prune_ephemeral();
drop function if exists public.enqueue_weekly_runs(date);
