-- Reverts 20261105000036_youtube_connector.sql. YouTube connections and interest are removed; the
-- checks and functions go back to their 0021/0027 versions.
delete from public.connector_interest where provider = 'youtube';
delete from public.connections where provider = 'youtube';
alter table public.connector_interest drop constraint if exists connector_interest_provider_check;
alter table public.connector_interest add constraint connector_interest_provider_check
  check (provider in ('gbp', 'apple_business_connect', 'bing_places', 'yelp', 'opentable', 'resy', 'site_cms',
                      'shopify', 'amazon', 'g2_capterra', 'search_console', 'ga4'));
alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check
  check (provider in ('gbp', 'search_console', 'ga4', 'shopify'));

create or replace function private.grant_connections(p_connection_id uuid) returns setof uuid
language sql stable set search_path = '' as $$
  select c2.id from public.connections c
  join public.connections c2 on c2.business_id = c.business_id
  where c.id = p_connection_id
    and (c2.id = c.id or (c.provider in ('gbp', 'search_console', 'ga4')
                          and c2.provider in ('gbp', 'search_console', 'ga4') and c2.status <> 'revoked'
                          and c2.external_account_id = c.external_account_id));
$$;

create or replace function public.save_connection(p_business_id uuid, p_provider text, p_external_account_id text,
                                                  p_scopes text[], p_connected_by uuid, p_enc_access text,
                                                  p_enc_refresh text, p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
  old_account text;
  refresh text;
begin
  perform private.require_service_role();
  if p_provider is null or p_provider not in ('gbp', 'search_console', 'ga4', 'shopify') then
    raise exception 'Unknown provider' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.businesses where id = p_business_id) then
    raise exception 'Unknown business' using errcode = 'invalid_parameter_value';
  end if;
  select external_account_id into old_account from public.connections
  where business_id = p_business_id and provider = p_provider;
  insert into public.connections (business_id, provider, status, external_account_id, scopes, connected_by,
                                  connected_at, last_checked_at)
  values (p_business_id, p_provider, 'connected', p_external_account_id, coalesce(p_scopes, '{}'), p_connected_by,
          now(), now())
  on conflict (business_id, provider) do update
    set status = 'connected', external_account_id = excluded.external_account_id, scopes = excluded.scopes,
        connected_by = excluded.connected_by, connected_at = now(), last_checked_at = now()
  returning id into cid;

  update public.connections set status = 'connected', last_checked_at = now()
  where id in (select private.grant_connections(cid)) and status = 'needs_reauth';
  -- This row's old refresh token counts only if it was for the same account.
  refresh := coalesce(p_enc_refresh, (
    select t.enc_refresh from public.connection_tokens t
    where t.connection_id in (select private.grant_connections(cid)) and t.enc_refresh is not null
      and (t.connection_id <> cid or old_account is not distinct from p_external_account_id)
    limit 1));
  insert into public.connection_tokens (connection_id, enc_access, enc_refresh, expires_at)
  select g, p_enc_access, refresh, p_expires_at from private.grant_connections(cid) as g
  on conflict (connection_id) do update
    set enc_access = excluded.enc_access, enc_refresh = excluded.enc_refresh, expires_at = excluded.expires_at;
  return cid;
end;
$$;

create or replace function public.note_connector_interest(p_business_id uuid, p_provider text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_business_member(p_business_id) or private.is_team_dfy_business(p_business_id)) then
    raise exception 'Not allowed for this business' using errcode = 'insufficient_privilege';
  end if;
  if p_provider is null or p_provider not in ('gbp', 'apple_business_connect', 'bing_places', 'yelp', 'opentable',
                                               'resy', 'site_cms', 'shopify', 'amazon', 'g2_capterra',
                                               'search_console', 'ga4') then
    raise exception 'Unknown connector' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.connector_interest (business_id, provider, user_id)
  values (p_business_id, p_provider, (select auth.uid()))
  on conflict do nothing;
end;
$$;

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
