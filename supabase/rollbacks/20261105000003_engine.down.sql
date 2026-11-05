-- Reverts 20261105000003_engine.sql
drop table if exists public.ai_traffic;
drop table if exists public.listing_snapshots;
drop table if exists public.citations;
drop table if exists public.answers;
drop table if exists public.runs;
drop function if exists private.can_read_answer(uuid);
drop function if exists private.can_read_run(uuid);
