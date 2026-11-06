-- Reverts 20261105000027_gas_ready.sql. The ready and dismissal times are dropped.
drop function if exists public.dismiss_gas_ready(uuid);
drop function if exists public.gas_ready(uuid);
drop function if exists public.refresh_gas_ready(uuid, text[]);
alter table public.businesses
  drop column if exists gas_ready_dismissed_at,
  drop column if exists gas_ready_at;
