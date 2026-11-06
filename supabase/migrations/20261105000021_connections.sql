-- Connections: one-click DFY access through official OAuth. Users read; every write is a service
-- RPC called by a server route after can_connect_business / can_apply_edits. Re-runnable.
-- Rollback: supabase/rollbacks/20261105000021_connections.down.sql

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null check (provider in ('gbp', 'search_console', 'ga4', 'shopify')),
  status text not null default 'connected' check (status in ('connected', 'needs_reauth', 'revoked')),
  external_account_id text,
  selected_entities jsonb not null default '[]' check (jsonb_typeof(selected_entities) = 'array'),
  scopes text[] not null default '{}',
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  unique (business_id, provider)
);

-- AES-GCM ciphertext from the app (GOOGLE_TOKEN_ENCRYPTION_KEY). Service role only.
create table if not exists public.connection_tokens (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  enc_access text,
  enc_refresh text,
  expires_at timestamptz
);

create table if not exists public.connection_changes (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor uuid not null,
  field text not null,
  before jsonb,
  after jsonb,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index if not exists connection_changes_connection_id_idx on public.connection_changes (connection_id);
create index if not exists connection_changes_business_id_idx on public.connection_changes (business_id, created_at desc);

create table if not exists public.connector_interest (
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null check (provider in ('gbp', 'apple_business_connect', 'bing_places', 'yelp', 'opentable',
                                             'resy', 'site_cms', 'shopify', 'amazon', 'g2_capterra',
                                             'search_console', 'ga4')),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, provider, user_id)
);
create index if not exists connector_interest_user_id_idx on public.connector_interest (user_id);

alter table public.connections enable row level security;
alter table public.connection_tokens enable row level security;
alter table public.connection_changes enable row level security;
alter table public.connector_interest enable row level security;

-- Users read their business's rows (members, incl. its dfy_client), and the team reads all DFY.
-- Nobody but the service role writes; tokens have no policy at all.
revoke all on table public.connections, public.connection_tokens, public.connection_changes,
  public.connector_interest from anon, authenticated;
grant select on table public.connections, public.connection_changes, public.connector_interest to authenticated;

drop policy if exists connections_read on public.connections;
create policy connections_read on public.connections for select to authenticated
  using (private.is_business_member(business_id) or private.is_team_dfy_business(business_id));
drop policy if exists connection_changes_read on public.connection_changes;
create policy connection_changes_read on public.connection_changes for select to authenticated
  using (private.is_business_member(business_id) or private.is_team_dfy_business(business_id));
drop policy if exists connector_interest_read on public.connector_interest;
create policy connector_interest_read on public.connector_interest for select to authenticated
  using (private.is_business_member(business_id) or private.is_team_dfy_business(business_id));

-- The change log is append-only. Inserts are checked (actor, the GBP field allowlist); updates are
-- refused; deletes only happen through the cascade from deleting the business or connection.
create or replace function private.guard_connection_change() returns trigger
language plpgsql set search_path = '' as $$
declare
  prov text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'The connection change log is append-only';
  elsif tg_op = 'DELETE' then
    if pg_trigger_depth() < 2 then
      raise exception 'The connection change log is append-only';
    end if;
    return old;
  end if;
  select provider into prov from public.connections where id = new.connection_id;
  if new.actor is null or prov is null then
    raise exception 'A change needs an actor and a connection' using errcode = 'invalid_parameter_value';
  end if;
  if prov = 'gbp' and new.field not in ('description', 'regular_hours', 'special_hours', 'website_uri',
                                         'primary_phone', 'attributes') then
    raise exception 'That Business Profile field is not editable' using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(new.field, '') = '' or char_length(new.field) > 100 then
    raise exception 'A change needs a field' using errcode = 'invalid_parameter_value';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_connection_change() from public;
drop trigger if exists connection_changes_guard on public.connection_changes;
create trigger connection_changes_guard before insert or update or delete on public.connection_changes
  for each row execute function private.guard_connection_change();

-- Route checks, with the signed-in user's client. Connect/revoke: the business's own members
-- (incl. its dfy_client), never the team. Apply edits: can_write_business (never a dfy_client).
create or replace function public.can_connect_business(p_business_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.is_business_member(p_business_id) and not private.is_team();
$$;
create or replace function public.can_apply_edits(p_business_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.can_write_business(p_business_id);
$$;

-- "Notify me" on a Coming soon tile: members (incl. a dfy_client) or the team on DFY. Idempotent.
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

create or replace function private.require_service_role() returns void
language plpgsql stable set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- The connections sharing a connection's grant: every non-revoked Google one (gbp, search_console,
-- ga4) of its business, since one Google grant covers them; otherwise just itself.
create or replace function private.grant_connections(p_connection_id uuid) returns setof uuid
language sql stable set search_path = '' as $$
  select c2.id from public.connections c
  join public.connections c2 on c2.business_id = c.business_id
  where c.id = p_connection_id
    and (c2.id = c.id or (c.provider in ('gbp', 'search_console', 'ga4')
                          and c2.provider in ('gbp', 'search_console', 'ga4') and c2.status <> 'revoked'));
$$;

-- Service only. Connects (or reconnects) a provider and stores its ciphertext tokens. For Google the
-- new tokens cover the whole grant, so the business's other live Google connections get them too.
create or replace function public.save_connection(p_business_id uuid, p_provider text, p_external_account_id text,
                                                  p_scopes text[], p_connected_by uuid, p_enc_access text,
                                                  p_enc_refresh text, p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
begin
  perform private.require_service_role();
  if p_provider is null or p_provider not in ('gbp', 'search_console', 'ga4', 'shopify') then
    raise exception 'Unknown provider' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.businesses where id = p_business_id) then
    raise exception 'Unknown business' using errcode = 'invalid_parameter_value';
  end if;
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
  insert into public.connection_tokens (connection_id, enc_access, enc_refresh, expires_at)
  select g, p_enc_access, p_enc_refresh, p_expires_at from private.grant_connections(cid) as g
  on conflict (connection_id) do update
    set enc_access = excluded.enc_access, enc_refresh = excluded.enc_refresh, expires_at = excluded.expires_at;
  return cid;
end;
$$;

-- Service only. Ciphertext tokens of a connected or needs_reauth connection; no row when revoked.
create or replace function public.get_connection_tokens(p_connection_id uuid)
returns table (enc_access text, enc_refresh text, expires_at timestamptz, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_service_role();
  return query
  select t.enc_access, t.enc_refresh, t.expires_at, c.status
  from public.connections c join public.connection_tokens t on t.connection_id = c.id
  where c.id = p_connection_id and c.status in ('connected', 'needs_reauth');
end;
$$;

-- Service only. After a token refresh, grant-wide. The refresh token is kept unless a new one is given.
create or replace function public.update_connection_tokens(p_connection_id uuid, p_enc_access text,
                                                           p_expires_at timestamptz, p_enc_refresh text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_service_role();
  update public.connection_tokens
  set enc_access = p_enc_access, expires_at = p_expires_at, enc_refresh = coalesce(p_enc_refresh, enc_refresh)
  where connection_id in (select private.grant_connections(p_connection_id));
end;
$$;

-- Service only. The picked locations/stores: a JSON array of at most 100 {id, name} objects.
create or replace function public.set_connection_entities(p_connection_id uuid, p_entities jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_service_role();
  if p_entities is null or jsonb_typeof(p_entities) <> 'array' or jsonb_array_length(p_entities) > 100
     or exists (select 1 from jsonb_array_elements(p_entities) e
                where jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'id') <> 'string') then
    raise exception 'Entities must be at most 100 {id, name} objects' using errcode = 'invalid_parameter_value';
  end if;
  update public.connections set selected_entities = p_entities where id = p_connection_id;
end;
$$;

-- Service only. connected or needs_reauth (a 401/invalid_grant), grant-wide; never un-revokes.
create or replace function public.set_connection_status(p_connection_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_service_role();
  if p_status is null or p_status not in ('connected', 'needs_reauth') then
    raise exception 'Status must be connected or needs_reauth' using errcode = 'invalid_parameter_value';
  end if;
  update public.connections set status = p_status, last_checked_at = now()
  where id in (select private.grant_connections(p_connection_id)) and status <> 'revoked';
end;
$$;

-- Service only. Google revokes the whole grant: every gbp/search_console/ga4 connection of the
-- business becomes revoked and its tokens are deleted, in one transaction. Returns the revoked ids.
create or replace function public.revoke_google_grant(p_business_id uuid) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
begin
  perform private.require_service_role();
  with r as (
    update public.connections set status = 'revoked', last_checked_at = now()
    where business_id = p_business_id and provider in ('gbp', 'search_console', 'ga4') and status <> 'revoked'
    returning id
  )
  select coalesce(array_agg(id), '{}') into ids from r;
  delete from public.connection_tokens t using public.connections c
  where c.id = t.connection_id and c.business_id = p_business_id and c.provider in ('gbp', 'search_console', 'ga4');
  return ids;
end;
$$;

-- Service only. Appends one DFY edit (who, field, before → after, the provider's response id).
create or replace function public.record_connection_change(p_connection_id uuid, p_actor uuid, p_field text,
                                                           p_before jsonb, p_after jsonb, p_provider_ref text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
begin
  perform private.require_service_role();
  insert into public.connection_changes (connection_id, business_id, actor, field, before, after, provider_ref)
  select c.id, c.business_id, p_actor, p_field, p_before, p_after, p_provider_ref
  from public.connections c where c.id = p_connection_id
  returning id into cid;
  if cid is null then
    raise exception 'Unknown connection' using errcode = 'invalid_parameter_value';
  end if;
  return cid;
end;
$$;

revoke all on function private.require_service_role(), private.grant_connections(uuid) from public;
revoke all on function public.save_connection(uuid, text, text, text[], uuid, text, text, timestamptz),
  public.get_connection_tokens(uuid), public.update_connection_tokens(uuid, text, timestamptz, text),
  public.set_connection_entities(uuid, jsonb), public.set_connection_status(uuid, text),
  public.revoke_google_grant(uuid), public.record_connection_change(uuid, uuid, text, jsonb, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.can_connect_business(uuid), public.can_apply_edits(uuid),
  public.note_connector_interest(uuid, text) from public, anon;
grant execute on function public.can_connect_business(uuid), public.can_apply_edits(uuid),
  public.note_connector_interest(uuid, text) to authenticated;
