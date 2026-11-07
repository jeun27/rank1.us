-- Reverts 20261105000041_business_profile.sql: the 0021 onboarding RPC, then the columns (their CHECK goes
-- with them) and the rule functions.
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
          coalesce(b ->> 'vertical', 'restaurant'), b ->> 'cuisine', b ->> 'city', b ->> 'state', b ->> 'country')
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

alter table public.businesses
  drop column if exists address, drop column if exists phone, drop column if exists category,
  drop column if exists services, drop column if exists service_area, drop column if exists profile_sources,
  drop column if exists profile_links;
drop function if exists private.profile_services_ok(text[]);
drop function if exists private.profile_links_ok(text[]);
drop function if exists private.profile_sources_ok(jsonb);
