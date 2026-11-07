-- Reverts 20261105000046_card_case_dedupe.sql: save_business_card as 0044 defined it.
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
  from (select e.v ->> 'key' as key, e.v ->> 'short' as short, e.v ->> 'long' as long, e.ord
        from jsonb_array_elements(p_questions) with ordinality as e(v, ord)) as n
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
     join (select e.v ->> 'key' as key, e.v ->> 'short' as short, e.v ->> 'long' as long, e.ord
        from jsonb_array_elements(p_questions) with ordinality as e(v, ord)) as n
       on q.short_text = n.short and q.long_text is not distinct from n.long
     where q.business_id = p_business_id and q.template_short is not null and q.short_text = q.template_short and q.long_text is not distinct from q.template_long and not q.owner_off) r
  where q.id = r.id and r.rk > free and q.active;
  update public.questions q set active = true
  from (select q.id, row_number() over (order by n.ord, q.id) as rk
     from public.questions q
     join (select e.v ->> 'key' as key, e.v ->> 'short' as short, e.v ->> 'long' as long, e.ord
        from jsonb_array_elements(p_questions) with ordinality as e(v, ord)) as n
       on q.short_text = n.short and q.long_text is not distinct from n.long
     where q.business_id = p_business_id and q.template_short is not null and q.short_text = q.template_short and q.long_text is not distinct from q.template_long and not q.owner_off) r
  where q.id = r.id and r.rk <= free and not q.active;
  perform set_config('rank1.card_save', 'off', true);
end;
$$;
revoke all on function public.save_business_card(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_business_card(uuid, jsonb, jsonb) to authenticated;
