-- Reverts 20261105000021_connections.sql. Connections, tokens, the change log and interest are dropped.
drop function if exists public.record_connection_change(uuid, uuid, text, jsonb, jsonb, text);
drop function if exists public.revoke_connection(uuid);
drop function if exists public.set_connection_status(uuid, text);
drop function if exists public.set_connection_entities(uuid, jsonb);
drop function if exists public.update_connection_tokens(uuid, text, timestamptz, text);
drop function if exists public.get_connection_tokens(uuid);
drop function if exists public.save_connection(uuid, text, text, text[], uuid, text, text, timestamptz);
drop function if exists public.note_connector_interest(uuid, text);
drop function if exists public.can_apply_edits(uuid);
drop function if exists public.can_connect_business(uuid);

drop table if exists public.connector_interest;
drop table if exists public.connection_changes;
drop table if exists public.connection_tokens;
drop table if exists public.connections;

drop function if exists private.grant_connections(uuid);
drop function if exists private.require_service_role();
drop function if exists private.guard_connection_change();

-- vertical goes back to unchecked, and the onboarding RPCs to always writing 'restaurant'.
alter table public.businesses drop constraint if exists businesses_vertical_check;
create or replace function private.check_business_input(b jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare
  f text;
begin
  foreach f in array array['name', 'domain', 'city', 'state', 'country'] loop
    if coalesce(btrim(b ->> f), '') = '' then
      raise exception 'business.% is required', f using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if char_length(b ->> 'name') > 200 then
    raise exception 'business.name must be at most 200 characters' using errcode = 'invalid_parameter_value';
  end if;
  if not private.is_hostname(b ->> 'domain') then
    raise exception 'business.domain must be a valid hostname' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(b ->> 'city') > 100 or char_length(b ->> 'state') > 100 or char_length(b ->> 'country') > 100 then
    raise exception 'business.city, state and country must be at most 100 characters' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(b ->> 'cuisine') > 60 then
    raise exception 'business.cuisine must be at most 60 characters' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

create or replace function public.create_business_onboarding(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ws uuid;
  biz uuid;
  b jsonb := p -> 'business';
begin
  if uid is null or exists (select 1 from public.user_roles where user_id = uid) then
    raise exception 'Only self-serve users can onboard a business' using errcode = 'insufficient_privilege';
  end if;
  select m.workspace_id into ws from public.workspace_members m
  where m.user_id = uid order by m.created_at, m.workspace_id limit 1;
  if ws is null then
    raise exception 'No workspace for this user' using errcode = 'insufficient_privilege';
  end if;
  perform private.check_business_input(b);
  if exists (select 1 from jsonb_to_recordset(coalesce(p -> 'competitors', '[]')) as c(name text, domain text)
             where coalesce(btrim(c.name), '') = '' or char_length(c.name) > 200
                or (nullif(btrim(c.domain), '') is not null and not private.is_hostname(btrim(c.domain)))) then
    raise exception 'Each competitor needs a name of at most 200 characters and a valid domain or none'
      using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from jsonb_to_recordset(coalesce(p -> 'questions', '[]')) as q(short_text text, long_text text)
             where coalesce(btrim(q.short_text), '') = '' or char_length(q.short_text) > 500
                or char_length(q.long_text) > 500) then
    raise exception 'Each question needs a short form, and both forms must be at most 500 characters'
      using errcode = 'invalid_parameter_value';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p -> 'questions', '[]')) q
      where coalesce((q ->> 'active')::boolean, true)) > 25 then
    raise exception 'A business can have at most 25 active questions' using errcode = 'check_violation';
  end if;

  insert into public.businesses (workspace_id, name, domain, aliases, vertical, cuisine, city, state, country)
  values (ws, b ->> 'name', b ->> 'domain',
          coalesce(array(select jsonb_array_elements_text(b -> 'aliases')), '{}'),
          'restaurant', b ->> 'cuisine', b ->> 'city', b ->> 'state', b ->> 'country')
  returning id into biz;

  insert into public.competitors (business_id, name, domain, rating, maps_cid, source)
  select biz, c.name, nullif(btrim(c.domain), ''), c.rating, c.maps_cid, c.source
  from jsonb_to_recordset(coalesce(p -> 'competitors', '[]'))
    as c(name text, domain text, rating numeric, maps_cid text, source text);

  insert into public.questions (business_id, short_text, long_text, active_form, active, location_level,
                                country, state, city, template_key)
  select biz, q.short_text, q.long_text, coalesce(q.active_form, 'long'), coalesce(q.active, true),
         q.location_level, q.country, q.state, q.city, q.template_key
  from jsonb_to_recordset(coalesce(p -> 'questions', '[]'))
    as q(short_text text, long_text text, active_form text, active boolean, location_level text,
         country text, state text, city text, template_key text);

  return biz;
end;
$$;

create or replace function public.create_dfy_client(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ws uuid;
  biz uuid;
  b jsonb := p -> 'business';
begin
  if uid is null or not exists (select 1 from public.user_roles where user_id = uid and role = 'team') then
    raise exception 'Only the Rank1 team can create DFY clients' using errcode = 'insufficient_privilege';
  end if;
  perform private.check_business_input(b);
  if char_length(p ->> 'workspace_name') > 200 then
    raise exception 'workspace_name must be at most 200 characters' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.workspaces (name, owner_id)
  values (coalesce(nullif(p ->> 'workspace_name', ''), b ->> 'name'), uid)
  returning id into ws;

  insert into public.businesses (workspace_id, name, domain, aliases, vertical, cuisine, city, state, country,
                                 service, fix_list_visible)
  values (ws, b ->> 'name', b ->> 'domain',
          coalesce(array(select jsonb_array_elements_text(b -> 'aliases')), '{}'),
          'restaurant', b ->> 'cuisine', b ->> 'city', b ->> 'state', b ->> 'country', 'dfy', false)
  returning id into biz;

  return jsonb_build_object('workspace_id', ws, 'business_id', biz);
end;
$$;

drop function if exists private.is_vertical(text);
