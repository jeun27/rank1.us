-- Onboarding v2 (BE3): saving the business card reconciles its questions in one transaction (lead Q1-Q4,
-- 2026-11-07). Additive (live builds never call save_business_card). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000044_save_business_card.down.sql

-- A generated row keeps the builder's output for its template_key. Its text differing from it means the
-- owner edited it; legacy rows (null here) read as edited, so a save never touches them.
alter table public.questions
  add column if not exists template_short text,
  add column if not exists template_long text;

-- owner_off: the owner switched the row off (lead: a card save never undoes that). Every change to active
-- outside save_business_card is the owner's (onboarding's step 3 included), so a trigger records it;
-- the save marks its own writes with the transaction-local setting rank1.card_save.
alter table public.questions add column if not exists owner_off boolean not null default false;
create or replace function private.record_owner_toggle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('rank1.card_save', true), '') <> 'on'
     and (tg_op = 'INSERT' or new.active is distinct from old.active) then
    new.owner_off := not new.active;
  end if;
  return new;
end;
$$;
revoke all on function private.record_owner_toggle() from public;
drop trigger if exists questions_owner_toggle on public.questions;
create trigger questions_owner_toggle before insert or update of active on public.questions
  for each row execute function private.record_owner_toggle();

-- The question picks (landmarks, areas, dietary, occasion), so Settings can regenerate and prefill them.
create or replace function private.question_picks_ok(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object' and not exists (
    select 1 from jsonb_each(case when jsonb_typeof(j) = 'object' then j else '{}' end) e
    where e.key not in ('landmarks', 'areas', 'dietary', 'occasion')
       or jsonb_typeof(e.value) <> 'array'
       or (case when jsonb_typeof(e.value) = 'array' then jsonb_array_length(e.value) else 0 end) > 30
       or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(e.value) = 'array' then e.value else '[]' end) x
                  where jsonb_typeof(x) <> 'string' or btrim(x #>> '{}') = '' or char_length(x #>> '{}') > 100));
$$;
revoke all on function private.question_picks_ok(jsonb) from public;
grant execute on function private.question_picks_ok(jsonb) to authenticated, service_role;
alter table public.businesses add column if not exists question_picks jsonb not null default '{}';
alter table public.businesses drop constraint if exists businesses_question_picks_check;
alter table public.businesses add constraint businesses_question_picks_check check (private.question_picks_ok(question_picks));
grant insert (question_picks), update (question_picks) on table public.businesses to authenticated;

-- Invoker (RLS applies): only someone who can write the business. p_card holds the card fields to change;
-- p_questions is the builder's output for the new card, in template order: [{ key, short, long }].
-- Hand-added (no template_key) and edited rows are untouched. A row's text never changes: an unedited
-- generated row whose text is no longer produced is switched off, and its replacement is this
-- business's row with exactly the new text (reused, so a round trip restores ids) or a new row (owner_off
-- when its key's current row is owner_off). Owner
-- rows keep their active flag and owner_off rows stay off; the other matching rows fill the free slots
-- of the 25 cap in output order, so rows a save switched off come back when their text applies again.
-- Errors: 42501, 22023 bad input, 23514 a CHECK.
create or replace function public.save_business_card(p_business_id uuid, p_card jsonb, p_questions jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  b public.businesses;
  m jsonb;
  free bigint;
  off_keys text[];
begin
  select * into b from public.businesses where id = p_business_id for update;
  perform set_config('rank1.card_save', 'on', true);
  if auth.uid() is null or not found or not private.member_can_write_business(p_business_id) then
    raise exception 'Not allowed to edit this business' using errcode = 'insufficient_privilege';
  end if;
  m := to_jsonb(b) || coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(p_card, '{}')) e
                                where e.key in ('name', 'vertical', 'cuisine', 'city', 'state', 'address', 'phone',
                                                'category', 'services', 'service_area', 'profile_sources',
                                                'profile_links', 'question_picks')), '{}');
  perform private.check_business_input(m);
  if coalesce(jsonb_typeof(p_questions), '') <> 'array'
     or exists (select 1 from jsonb_to_recordset(p_questions) as n(key text, short text, long text)
                where coalesce(btrim(n.key), '') = '' or char_length(n.key) > 300
                   or coalesce(btrim(n.short), '') = '' or char_length(n.short) > 500 or char_length(n.long) > 500)
     or (select count(distinct n.key) <> count(*) from jsonb_to_recordset(p_questions) as n(key text)) then
    raise exception 'Each question needs a unique key and a short form, both forms at most 500 characters'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.businesses set
    name = btrim(m ->> 'name'), vertical = m ->> 'vertical', cuisine = nullif(btrim(m ->> 'cuisine'), ''),
    city = btrim(m ->> 'city'), state = btrim(m ->> 'state'),
    address = nullif(btrim(m ->> 'address'), ''), phone = nullif(btrim(m ->> 'phone'), ''),
    category = nullif(btrim(m ->> 'category'), ''), service_area = nullif(btrim(m ->> 'service_area'), ''),
    services = array(select btrim(jsonb_array_elements_text(coalesce(nullif(m -> 'services', 'null'::jsonb), '[]')))),
    profile_sources = coalesce(nullif(m -> 'profile_sources', 'null'::jsonb), '{}'),
    profile_links = array(select jsonb_array_elements_text(coalesce(nullif(m -> 'profile_links', 'null'::jsonb), '[]'))),
    question_picks = coalesce(nullif(m -> 'question_picks', 'null'::jsonb), '{}')
  where id = p_business_id
  returning * into b;

  -- Keys whose current row the owner switched off (none of its rows active): a new row for such a key
  -- starts owner_off too (lead: the owner said no to the question, not to the city).
  select coalesce(array_agg(distinct q.template_key), '{}') into off_keys from public.questions q
  where q.business_id = p_business_id and q.owner_off and q.template_key is not null
    and not exists (select 1 from public.questions a
                    where a.business_id = p_business_id and a.template_key = q.template_key and a.active);

  -- A row's text never changes (its history measures that exact question). Unedited generated rows whose
  -- text the new card no longer produces are switched off (system-off, history kept).
  update public.questions q set active = false
  where q.business_id = p_business_id and q.active and q.template_short is not null and q.short_text = q.template_short and q.long_text is not distinct from q.template_long
    and not exists (select 1 from jsonb_to_recordset(p_questions) as n(short text, long text)
                    where n.short = q.short_text and n.long is not distinct from q.long_text);

  -- Each new output reuses this business's row with exactly that text (a round trip gets its ids back),
  -- else a new row, located in the card's city. A text the business already has in another case or as
  -- an owner row is not added again.
  update public.questions q set template_key = n.key
  from jsonb_to_recordset(p_questions) as n(key text, short text, long text)
  where q.business_id = p_business_id and q.template_short is not null and q.short_text = q.template_short and q.long_text is not distinct from q.template_long
    and q.short_text = n.short and q.long_text is not distinct from n.long and q.template_key <> n.key;
  insert into public.questions (business_id, short_text, long_text, template_short, template_long, template_key,
                                active_form, active, owner_off, location_level, country, state, city)
  select p_business_id, n.short, n.long, n.short, n.long, n.key, 'long', false, n.key = any (off_keys), 'city',
         b.country, b.state, b.city
  from jsonb_to_recordset(p_questions) with ordinality as n(key text, short text, long text, ord bigint)
  where not exists (select 1 from public.questions q
                    where q.business_id = p_business_id and lower(q.short_text) = lower(n.short))
  order by n.ord;

  -- Owner rows (hand-added or edited) keep their flag and owner_off rows stay off; the matching template
  -- rows fill the rest of the 25 slots in output order. Off before on, so the cap trigger never sees 26.
  select 25 - count(*) into free from public.questions q
  where q.business_id = p_business_id and q.active
    and (q.template_key is null or q.template_short is null or q.short_text <> q.template_short
         or q.long_text is distinct from q.template_long);
  update public.questions q set active = false
  from (select q.id, row_number() over (order by n.ord, q.id) as rk
     from public.questions q
     join jsonb_to_recordset(p_questions) with ordinality as n(key text, short text, long text, ord bigint)
       on q.short_text = n.short and q.long_text is not distinct from n.long
     where q.business_id = p_business_id and q.template_short is not null and q.short_text = q.template_short and q.long_text is not distinct from q.template_long and not q.owner_off) r
  where q.id = r.id and r.rk > free and q.active;
  update public.questions q set active = true
  from (select q.id, row_number() over (order by n.ord, q.id) as rk
     from public.questions q
     join jsonb_to_recordset(p_questions) with ordinality as n(key text, short text, long text, ord bigint)
       on q.short_text = n.short and q.long_text is not distinct from n.long
     where q.business_id = p_business_id and q.template_short is not null and q.short_text = q.template_short and q.long_text is not distinct from q.template_long and not q.owner_off) r
  where q.id = r.id and r.rk <= free and not q.active;
  perform set_config('rank1.card_save', 'off', true);
end;
$$;
revoke all on function public.save_business_card(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_business_card(uuid, jsonb, jsonb) to authenticated;

-- Onboarding stores the picks and each generated row's template output too (the same model the card
-- save reconciles against); step 3 edits survive as edited rows.
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
                                address, phone, category, services, service_area, profile_sources, profile_links,
                                question_picks)
  values (ws, b ->> 'name', b ->> 'domain',
          coalesce(array(select jsonb_array_elements_text(b -> 'aliases')), '{}'),
          coalesce(b ->> 'vertical', 'restaurant'), b ->> 'cuisine', b ->> 'city', b ->> 'state', b ->> 'country',
          nullif(btrim(b ->> 'address'), ''), nullif(btrim(b ->> 'phone'), ''), nullif(btrim(b ->> 'category'), ''),
          coalesce(array(select btrim(jsonb_array_elements_text(b -> 'services'))), '{}'),
          nullif(btrim(b ->> 'service_area'), ''),
          coalesce(nullif(b -> 'profile_sources', 'null'::jsonb), '{}'),
          coalesce(array(select jsonb_array_elements_text(b -> 'profile_links')), '{}'),
          coalesce(nullif(p -> 'question_picks', 'null'::jsonb), '{}'))
  returning id into biz;

  insert into public.competitors (business_id, name, domain, rating, maps_cid, source)
  select biz, c.name, nullif(btrim(c.domain), ''), c.rating, c.maps_cid, c.source
  from jsonb_to_recordset(coalesce(p -> 'competitors', '[]'))
    as c(name text, domain text, rating numeric, maps_cid text, source text);

  insert into public.questions (business_id, short_text, long_text, active_form, active, location_level,
                                country, state, city, template_key, template_short, template_long)
  select biz, q.short_text, q.long_text, coalesce(q.active_form, 'long'), coalesce(q.active, true),
         q.location_level, q.country, q.state, q.city, q.template_key, q.template_short, q.template_long
  from jsonb_to_recordset(coalesce(p -> 'questions', '[]'))
    as q(short_text text, long_text text, active_form text, active boolean, location_level text,
         country text, state text, city text, template_key text, template_short text, template_long text);

  return biz;
end;
$$;
