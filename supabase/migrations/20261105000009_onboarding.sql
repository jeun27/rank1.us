-- Step 5: seat rule for unpaid workspaces, team fix-list access (#9), onboarding RPCs.
-- Rollback: supabase/rollbacks/20261105000009_onboarding.down.sql

-- Seats: an unpaid workspace (seats 0) may hold one active business; otherwise active
-- self-serve businesses stay below seats_quantity. dfy businesses are exempt and uncounted.
create or replace function private.enforce_business_seats() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  seats int;
  active int;
begin
  if new.service = 'dfy' then
    return new;
  end if;
  if auth.uid() is not null and not private.is_member(new.workspace_id) then
    return new;
  end if;
  if new.archived_at is null
     and (tg_op = 'INSERT' or old.archived_at is not null or old.workspace_id <> new.workspace_id
          or old.service <> new.service) then
    select seats_quantity into seats from public.workspaces where id = new.workspace_id for update;
    select count(*) into active from public.businesses
      where workspace_id = new.workspace_id and archived_at is null and service <> 'dfy' and id <> new.id;
    if active > 0 and active >= seats then
      raise exception 'Workspace has no free seat for another active business' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
drop trigger businesses_seat_limit on public.businesses;
create trigger businesses_seat_limit
  before insert or update of archived_at, workspace_id, service on public.businesses
  for each row execute function private.enforce_business_seats();

-- Fixes: the Rank1 team always sees and edits fix lists of businesses it is a member of.
-- dfy_client members read only when fix_list_visible is on, and never write (#9).
create function private.is_team() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'team');
$$;

create or replace function private.can_see_fix_list(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b and (bz.service = 'self_serve' or bz.fix_list_visible or private.is_team())
      and private.is_business_member(bz.id)
  );
$$;

create function private.can_write_fixes(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b and (bz.service = 'self_serve' or private.is_team())
      and private.is_business_member(bz.id)
  );
$$;

revoke all on function private.is_team(), private.can_write_fixes(uuid) from public;
grant execute on function private.is_team(), private.can_write_fixes(uuid) to authenticated;

drop policy fixes_insert on public.fixes;
drop policy fixes_update on public.fixes;
drop policy fixes_delete on public.fixes;
create policy fixes_insert on public.fixes for insert to authenticated
  with check (private.can_write_fixes(business_id));
create policy fixes_update on public.fixes for update to authenticated
  using (private.can_write_fixes(business_id)) with check (private.can_write_fixes(business_id));
create policy fixes_delete on public.fixes for delete to authenticated
  using (private.can_write_fixes(business_id));

-- Shared input checks for the onboarding RPCs. Raises 22023 (invalid_parameter_value).
create function private.check_business_input(b jsonb) returns void
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

-- Hostname: at most 253 characters, labels of 1-63 letters, digits or inner hyphens, a dot-separated TLD.
create function private.is_hostname(d text) returns boolean
language sql immutable set search_path = '' as $$
  select d is not null and char_length(d) <= 253
    and d ~* '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$';
$$;

revoke all on function private.check_business_input(jsonb), private.is_hostname(text) from public;
grant execute on function private.check_business_input(jsonb), private.is_hostname(text) to authenticated;

-- Onboarding: business + competitors + questions in one transaction, as the caller, so RLS,
-- the businesses column grants and both limit triggers apply. Only listed fields are read.
create function public.create_business_onboarding(p jsonb) returns uuid
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

-- Team only: a client workspace owned by the team caller, with one dfy business whose fix
-- list starts hidden from the client.
create function public.create_dfy_client(p jsonb) returns jsonb
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

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.create_business_onboarding(jsonb), public.create_dfy_client(jsonb) from public, anon;
grant execute on function public.create_business_onboarding(jsonb), public.create_dfy_client(jsonb) to authenticated;
