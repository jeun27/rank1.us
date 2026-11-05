-- Reverts 20261105000010_rate_limits.sql
drop function if exists public.take_rate_token(text, int, interval);
drop table if exists public.rate_events;
