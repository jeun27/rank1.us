-- How many entities (GBP locations, Search Console sites, GA4 properties, YouTube channels) a
-- connection's account offers, stored when the picker list is loaded, so the hub shows "Choose …" only
-- when there is more than one without calling Google on render. Additive. Re-runnable.
-- Rollback: supabase/rollbacks/20261105000040_connection_entity_count.down.sql

-- Null until the list has been loaded once. Users read it with the row; only the RPC below writes it.
alter table public.connections
  add column if not exists entity_count int check (entity_count between 0 and 100000);

-- Service role only. Per connection (not grant-wide: each provider lists its own entities).
-- 22023 for a bad count or an unknown connection.
create or replace function public.set_connection_entity_count(p_connection_id uuid, p_count int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role only' using errcode = 'insufficient_privilege';
  end if;
  if p_count is null or p_count not between 0 and 100000 then
    raise exception 'The count must be 0 to 100000' using errcode = 'invalid_parameter_value';
  end if;
  update public.connections set entity_count = p_count where id = p_connection_id;
  if not found then
    raise exception 'Unknown connection' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;
revoke all on function public.set_connection_entity_count(uuid, int) from public, anon, authenticated;
