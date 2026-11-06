-- Reverts 20261105000022_hardening.sql: claim_jobs and create_free_audit go back to their 0012 versions.
drop function if exists public.bump_free_audit_notify_attempts(uuid);

create or replace function public.claim_jobs(p_limit int) returns setof jsonb
language plpgsql security definer set search_path = '' as $$
declare
  stale uuid;
begin
  if p_limit is null or p_limit < 1 then
    return;
  end if;
  for stale in
    select id from public.run_jobs
    where status = 'running' and locked_at < now() - interval '10 minutes' and attempts >= 3
    for update skip locked
  loop
    perform private.complete_job(stale, '{"status": "failed", "error": "Gave up after 3 attempts"}', '[]', 'failed');
  end loop;

  return query
  with picked as (
    select id from public.run_jobs
    where status = 'queued'
       or (status = 'running' and locked_at < now() - interval '10 minutes' and attempts < 3)
    order by (run_kind = 'free_audit') desc, created_at, id
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.run_jobs rj
    set status = 'running', locked_at = now(), attempts = rj.attempts + 1
    from picked where rj.id = picked.id
    returning rj.*
  ), started as (
    update public.runs set status = 'running'
    where id in (select run_id from claimed) and status = 'queued'
  )
  select jsonb_build_object(
    'job_id', c.id, 'run_id', c.run_id, 'engine', c.engine, 'run_index', c.run_index, 'attempt', c.attempts,
    'question', case when q.id is null then jsonb_build_object(
      'id', null, 'text', c.question_text, 'location_level', c.location_level, 'country', c.country,
      'state', case when c.location_level in ('state', 'city') then c.state end,
      'city', case when c.location_level = 'city' then c.city end,
      'dfs_location_code', c.dfs_location_code)
    else jsonb_build_object(
      'id', q.id,
      'text', case when q.active_form = 'long' then coalesce(q.long_text, q.short_text) else q.short_text end,
      'location_level', q.location_level,
      'country', coalesce(q.country, b.country),
      'state', case when q.location_level in ('state', 'city') then coalesce(q.state, b.state) end,
      'city', case when q.location_level = 'city' then coalesce(q.city, b.city) end,
      'dfs_location_code', q.dfs_location_code) end,
    'business', case when b.id is null then fa.brands -> 'business'
      else jsonb_build_object('id', b.id, 'name', b.name, 'aliases', to_jsonb(b.aliases), 'domain', b.domain) end,
    'competitors', case when b.id is null then coalesce(fa.brands -> 'competitors', '[]') else coalesce((
      select jsonb_agg(jsonb_build_object('id', co.id, 'name', co.name, 'aliases', to_jsonb(co.aliases), 'domain', co.domain)
                       order by co.name)
      from public.competitors co where co.business_id = b.id and not co.hidden), '[]') end)
  from claimed c
  left join public.questions q on q.id = c.question_id
  left join public.businesses b on b.id = q.business_id
  left join public.free_audits fa on fa.run_id = c.run_id
  order by (c.run_kind = 'free_audit') desc, c.created_at, c.id;
end;
$$;

create or replace function public.create_free_audit(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.leads;
  b jsonb := p -> 'business';
  loc jsonb := p -> 'location';
  qs jsonb := coalesce(p -> 'questions', '[]');
  cs jsonb := coalesce(p -> 'competitors', '[]');
  v_domain text := lower(btrim(b ->> 'domain'));
  rid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can start a free audit' using errcode = 'insufficient_privilege';
  end if;
  select * into l from public.leads where id = (p ->> 'lead_id')::uuid for update;
  if not found then
    raise exception 'Unknown lead' using errcode = 'invalid_parameter_value';
  end if;
  if l.run_id is not null then
    return l.run_id;
  end if;

  if not private.is_hostname(v_domain) then
    raise exception 'business.domain must be a valid hostname' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(b ->> 'name') > 200 then
    raise exception 'business.name must be at most 200 characters' using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(btrim(loc ->> 'country'), '') = '' or char_length(loc ->> 'country') > 100
     or char_length(loc ->> 'state') > 100 or char_length(loc ->> 'city') > 100 then
    raise exception 'location.country is required; country, state and city must be at most 100 characters'
      using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(cs) <> 'array' or jsonb_array_length(cs) > 5 or exists (
    select 1 from jsonb_to_recordset(cs) as c(name text, domain text)
    where coalesce(btrim(c.name), '') = '' or char_length(c.name) > 200
       or (nullif(btrim(c.domain), '') is not null and not private.is_hostname(btrim(c.domain)))
  ) then
    raise exception 'At most 5 competitors, each with a name of at most 200 characters and a valid domain or none'
      using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(qs) <> 'array' or jsonb_array_length(qs) not between 1 and 25 or exists (
    select 1 from jsonb_to_recordset(qs) as q(text text, location_level text)
    where coalesce(btrim(q.text), '') = '' or char_length(q.text) > 500
       or q.location_level is null or q.location_level not in ('country', 'state', 'city')
  ) then
    raise exception '1 to 25 questions, each with text of at most 500 characters and a location level'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.runs (business_id, kind, status, jobs_total, started_at)
  values (null, 'free_audit', 'queued', jsonb_array_length(qs) * 10, now())
  returning id into rid;

  insert into public.run_jobs (run_id, run_kind, question_id, question_text, location_level, country, state, city,
                               engine, run_index)
  select rid, 'free_audit', null, btrim(q.text), q.location_level, btrim(loc ->> 'country'),
         case when q.location_level in ('state', 'city') then nullif(btrim(loc ->> 'state'), '') end,
         case when q.location_level = 'city' then nullif(btrim(loc ->> 'city'), '') end,
         e.engine, i
  from jsonb_to_recordset(qs) as q(text text, location_level text)
  cross join (values ('chatgpt', 3), ('gemini', 3), ('google_aio', 3), ('perplexity', 1)) as e(engine, runs)
  cross join lateral generate_series(1, e.runs) as i;

  insert into public.free_audits (run_id, lead_id, domain, brands, country, state, city)
  values (rid, l.id, v_domain,
          jsonb_build_object(
            'business', jsonb_build_object(
              'id', 'business', 'name', coalesce(nullif(btrim(b ->> 'name'), ''), v_domain),
              'aliases', coalesce(b -> 'aliases', '[]'), 'domain', v_domain),
            'competitors', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'id', 'competitor-' || c.n, 'name', btrim(c.v ->> 'name'),
                       'aliases', coalesce(c.v -> 'aliases', '[]'),
                       'domain', lower(nullif(btrim(c.v ->> 'domain'), ''))) order by c.n)
              from jsonb_array_elements(cs) with ordinality as c(v, n)), '[]')),
          btrim(loc ->> 'country'), nullif(btrim(loc ->> 'state'), ''), nullif(btrim(loc ->> 'city'), ''));

  update public.leads set run_id = rid where id = l.id;
  return rid;
end;
$$;

revoke all on function public.claim_jobs(int), public.create_free_audit(jsonb) from public, anon, authenticated;
