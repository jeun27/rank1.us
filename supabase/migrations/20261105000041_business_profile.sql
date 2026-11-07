-- Onboarding v2 (O1, BE1): the business profile read from the site, all optional. Business type is the
-- existing vertical; dietary and occasion stay question picks. Additive: the live build sends none of
-- these and gets the defaults. Re-runnable. Rollback: supabase/rollbacks/20261105000041_business_profile.down.sql

-- profile_sources maps a field to where its value came from (schema | meta | title | nav | sitemap |
-- default | user); profile_links are the site's sameAs profiles (GBP, Yelp, YouTube…).
alter table public.businesses
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists category text,
  add column if not exists services text[] not null default '{}',
  add column if not exists service_area text,
  add column if not exists profile_sources jsonb not null default '{}',
  add column if not exists profile_links text[] not null default '{}';

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
  if b ? 'vertical' and jsonb_typeof(b -> 'vertical') <> 'null' and not private.is_vertical(b ->> 'vertical') then
    raise exception 'business.vertical is not a known vertical' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(b ->> 'cuisine') > 60 then
    raise exception 'business.cuisine must be at most 60 characters' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(b ->> 'address') > 200 or char_length(b ->> 'service_area') > 200
     or char_length(b ->> 'phone') > 40 or char_length(b ->> 'category') > 100 then
    raise exception 'business.address and service_area must be at most 200 characters, phone 40, category 100'
      using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(jsonb_typeof(b -> 'services'), 'null') not in ('null', 'array')
     or jsonb_array_length(case when jsonb_typeof(b -> 'services') = 'array' then b -> 'services' else '[]' end) > 30
     or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(b -> 'services') = 'array' then b -> 'services' else '[]' end) s
                where jsonb_typeof(s) <> 'string' or btrim(s #>> '{}') = '' or char_length(s #>> '{}') > 100) then
    raise exception 'business.services must be at most 30 non-empty names of at most 100 characters' using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(jsonb_typeof(b -> 'profile_links'), 'null') not in ('null', 'array')
     or jsonb_array_length(case when jsonb_typeof(b -> 'profile_links') = 'array' then b -> 'profile_links' else '[]' end) > 20
     or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(b -> 'profile_links') = 'array' then b -> 'profile_links' else '[]' end) s
                where jsonb_typeof(s) <> 'string' or (s #>> '{}') !~ '^https?://\S+$' or char_length(s #>> '{}') > 500) then
    raise exception 'business.profile_links must be at most 20 http(s) URLs' using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(jsonb_typeof(b -> 'profile_sources'), 'null') not in ('null', 'object')
     or exists (select 1 from jsonb_each(case when jsonb_typeof(b -> 'profile_sources') = 'object'
                                              then b -> 'profile_sources' else '{}' end) e
                where coalesce(e.value #>> '{}', '') not in ('schema', 'meta', 'title', 'nav', 'sitemap', 'default', 'user')) then
    raise exception 'business.profile_sources values must be schema, meta, title, nav, sitemap, default or user'
      using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- Stores the profile fields too (create_dfy_client still ignores them).
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
          case when jsonb_typeof(b -> 'profile_sources') = 'object' then b -> 'profile_sources' else '{}' end,
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
