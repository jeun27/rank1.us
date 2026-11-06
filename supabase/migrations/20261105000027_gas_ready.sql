-- G3 "Ready for GAS": when every Recommended connection of a business is connected, plus the team
-- notice's dismissal. Additive (live builds never touch these). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000027_gas_ready.down.sql

-- Readable like the business; not in the 0007 column grants, so members can't write them.
alter table public.businesses
  add column if not exists gas_ready_at timestamptz,
  add column if not exists gas_ready_dismissed_at timestamptz;

-- Service role only. p_recommended = the business's Recommended providers (recommend.ts, by vertical).
-- Ready when each has a connected connection (an empty list never is): gas_ready_at keeps its first
-- time. Otherwise both columns clear, so the next ready shows the notice again. 22023 unknown key.
create or replace function public.refresh_gas_ready(p_business_id uuid, p_recommended text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  was timestamptz;
  ready boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role only' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from unnest(coalesce(p_recommended, '{}')) k
             where k is null or k not in ('gbp', 'apple_business_connect', 'bing_places', 'yelp', 'opentable', 'resy',
                                          'site_cms', 'shopify', 'amazon', 'g2_capterra', 'search_console', 'ga4')) then
    raise exception 'Unknown connector' using errcode = 'invalid_parameter_value';
  end if;
  select gas_ready_at into was from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'Unknown business' using errcode = 'invalid_parameter_value';
  end if;
  ready := coalesce(cardinality(p_recommended), 0) > 0 and not exists (
    select 1 from unnest(p_recommended) k
    where not exists (select 1 from public.connections c
                      where c.business_id = p_business_id and c.provider = k and c.status = 'connected'));
  if ready then
    update public.businesses set gas_ready_at = coalesce(gas_ready_at, now()) where id = p_business_id;
  else
    update public.businesses set gas_ready_at = null, gas_ready_dismissed_at = null where id = p_business_id;
  end if;
  return jsonb_build_object('ready', ready, 'newly_ready', ready and was is null);
end;
$$;

-- The ready state for members (incl. the dfy_client) and the team on DFY; no row for anyone else.
-- The notice shows until it's dismissed or the team moves a fix after the ready time (U3).
create or replace function public.gas_ready(p_business_id uuid)
returns table (ready_at timestamptz, show_notice boolean)
language sql stable security definer set search_path = '' as $$
  select b.gas_ready_at,
         b.gas_ready_at is not null and b.gas_ready_dismissed_at is null and not exists (
           select 1 from public.fixes f
           join public.user_roles r on r.user_id = f.status_changed_by and r.role = 'team'
           where f.business_id = b.id and f.status_changed_at >= b.gas_ready_at)
  from public.businesses b
  where b.id = p_business_id
    and (private.is_business_member(b.id) or private.is_team_dfy_business(b.id));
$$;

-- The team on a DFY business dismisses the ready notice. 42501 for anyone else.
create or replace function public.dismiss_gas_ready(p_business_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_team_dfy_business(p_business_id) then
    raise exception 'Only the team can dismiss this' using errcode = 'insufficient_privilege';
  end if;
  update public.businesses set gas_ready_dismissed_at = now()
  where id = p_business_id and gas_ready_at is not null;
end;
$$;

revoke all on function public.refresh_gas_ready(uuid, text[]) from public, anon, authenticated;
revoke all on function public.gas_ready(uuid), public.dismiss_gas_ready(uuid) from public, anon;
grant execute on function public.gas_ready(uuid), public.dismiss_gas_ready(uuid) to authenticated;
