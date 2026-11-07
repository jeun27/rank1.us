-- Onboarding v2 (O1, BE1): the business profile read from the site, all optional. Business type is the
-- existing vertical; dietary and occasion stay question picks. Additive: the live build sends none of
-- these and gets the defaults. Re-runnable. Rollback: supabase/rollbacks/20261105000041_business_profile.down.sql

-- The element rules for the CHECKs below (a CHECK can't hold a subquery).
create or replace function private.profile_services_ok(a text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(a) <= 30 and not exists (select 1 from unnest(a) x where x is null or btrim(x) = '' or char_length(x) > 100);
$$;
create or replace function private.profile_links_ok(a text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(a) <= 20 and not exists (select 1 from unnest(a) x where x is null or x !~ '^https://\S+$' or char_length(x) > 500);
$$;
create or replace function private.profile_sources_ok(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object' and not exists (
    select 1 from jsonb_each(case when jsonb_typeof(j) = 'object' then j else '{}' end) e
    where jsonb_typeof(e.value) <> 'string'
       or e.value #>> '{}' not in ('schema', 'meta', 'title', 'nav', 'sitemap', 'default', 'user'));
$$;
revoke all on function private.profile_services_ok(text[]), private.profile_links_ok(text[]),
  private.profile_sources_ok(jsonb) from public;
grant execute on function private.profile_services_ok(text[]), private.profile_links_ok(text[]),
  private.profile_sources_ok(jsonb) to authenticated, service_role;

-- The rules live on the table (members can update businesses directly), so every write path gets them:
-- 23514 for a value outside them. profile_sources maps a field to where its value came from; a user
-- edit makes it 'user'. profile_links are the site's sameAs profiles (GBP, Yelp, YouTube…), https only.
alter table public.businesses
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists category text,
  add column if not exists services text[] not null default '{}',
  add column if not exists service_area text,
  add column if not exists profile_sources jsonb not null default '{}',
  add column if not exists profile_links text[] not null default '{}';
alter table public.businesses drop constraint if exists businesses_profile_check;
alter table public.businesses add constraint businesses_profile_check check (
  char_length(address) <= 200 and char_length(service_area) <= 200
  and char_length(phone) <= 40 and char_length(category) <= 100
  and private.profile_services_ok(services) and private.profile_links_ok(profile_links)
  and private.profile_sources_ok(profile_sources));

-- Stores the profile fields too; the CHECK above validates them (create_dfy_client still ignores them).
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

  insert into public.businesses (workspace_id, name, domain, aliases, vertical, cuisine, city, state, country,
                                address, phone, category, services, service_area, profile_sources, profile_links)
  values (ws, b ->> 'name', b ->> 'domain',
          coalesce(array(select jsonb_array_elements_text(b -> 'aliases')), '{}'),
          coalesce(b ->> 'vertical', 'restaurant'), b ->> 'cuisine', b ->> 'city', b ->> 'state', b ->> 'country',
          nullif(btrim(b ->> 'address'), ''), nullif(btrim(b ->> 'phone'), ''), nullif(btrim(b ->> 'category'), ''),
          coalesce(array(select btrim(jsonb_array_elements_text(b -> 'services'))), '{}'),
          nullif(btrim(b ->> 'service_area'), ''),
          coalesce(nullif(b -> 'profile_sources', 'null'::jsonb), '{}'),
          coalesce(array(select jsonb_array_elements_text(b -> 'profile_links')), '{}'))
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
