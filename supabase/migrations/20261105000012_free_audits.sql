-- Step 7: free audits. Their jobs carry the question and location inline (no business row), and
-- their brand list is a service-only snapshot. Answers now link to their job.
-- Rollback: supabase/rollbacks/20261105000012_free_audits.down.sql

-- Each job records its run's kind, so "no question only on a free audit" is a plain CHECK.
alter table public.runs add constraint runs_id_kind_key unique (id, kind);
alter table public.run_jobs add column run_kind text;
update public.run_jobs j set run_kind = r.kind from public.runs r where r.id = j.run_id;
alter table public.run_jobs
  alter column run_kind set not null,
  alter column question_id drop not null,
  add column question_text text,
  add column location_level text,
  add column country text,
  add column state text,
  add column city text,
  add column dfs_location_code int,
  add constraint run_jobs_run_kind_fkey foreign key (run_id, run_kind)
    references public.runs (id, kind) on delete cascade,
  add constraint run_jobs_question_by_kind_check check ((run_kind = 'free_audit') = (question_id is null)),
  add constraint run_jobs_inline_question_check
    check (question_id is not null or (question_text is not null and location_level is not null and country is not null)),
  add constraint run_jobs_location_level_check check (location_level in ('country', 'state', 'city'));

-- answers.job_id links each answer to the job that produced it (free-audit answers have no question).
alter table public.answers add column job_id uuid references public.run_jobs (id) on delete set null;
update public.answers a set job_id = j.id
from public.run_jobs j
where a.job_id is null and a.run_id = j.run_id and a.question_id = j.question_id
  and a.engine = j.engine and a.run_index = j.run_index;
create unique index answers_job_id_key on public.answers (job_id) where job_id is not null;

-- Service-only snapshot of a free audit: its brands (TrackedBrand shape), location and email state.
create table public.free_audits (
  run_id uuid primary key references public.runs (id) on delete cascade,
  lead_id uuid not null unique references public.leads (id) on delete cascade,
  domain text not null,
  brands jsonb not null,
  country text not null,
  state text,
  city text,
  notified_at timestamptz,
  notify_sent boolean,
  notify_attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.free_audits enable row level security;
revoke all on table public.free_audits from anon, authenticated;
-- Redefined from 0011: jobs record their run's kind.
create or replace function public.create_run(p_business_id uuid, p_kind text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
  b public.businesses;
  sub text;
  n int;
  rid uuid;
begin
  if p_kind is null or p_kind not in ('audit', 'weekly') then
    raise exception 'Run kind must be audit or weekly' using errcode = 'invalid_parameter_value';
  end if;
  select * into b from public.businesses where id = p_business_id for update;
  if not found or (not is_service and (p_kind <> 'audit' or not private.is_business_member(b.id))) then
    raise exception 'Not allowed to start a run for this business' using errcode = 'insufficient_privilege';
  end if;
  if b.archived_at is not null then
    raise exception 'Business is archived' using errcode = 'invalid_parameter_value';
  end if;
  select subscription_status into sub from public.workspaces where id = b.workspace_id;
  if b.service <> 'dfy' and coalesce(sub, '') not in ('active', 'trialing') then
    raise exception 'subscription_required' using errcode = 'P0402';
  end if;
  if exists (select 1 from public.runs where business_id = b.id and status in ('queued', 'running')) then
    raise exception 'run_in_progress' using errcode = 'P0409';
  end if;
  if not is_service and exists (
    select 1 from public.runs
    where business_id = b.id and kind = 'audit' and status <> 'failed' and started_at > now() - interval '24 hours'
  ) then
    raise exception 'audit_limit' using errcode = 'P0429';
  end if;
  select count(*) into n from public.questions where business_id = b.id and active;
  if n = 0 then
    raise exception 'Business has no active questions' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.runs (business_id, kind, status, jobs_total, started_at)
  values (b.id, p_kind, 'queued', n * 10, now())
  returning id into rid;
  insert into public.run_jobs (run_id, run_kind, question_id, engine, run_index)
  select rid, p_kind, q.id, e.engine, i
  from public.questions q
  cross join (values ('chatgpt', 3), ('gemini', 3), ('google_aio', 3), ('perplexity', 1)) as e(engine, runs)
  cross join lateral generate_series(1, e.runs) as i
  where q.business_id = b.id and q.active;
  return rid;
end;
$$;

-- Redefined from 0011: answers join their job by job_id.
create or replace function private.recompute_run(p_run_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  total int;
  open_n int;
  ok_n int;
  fail_n int;
  cost numeric;
begin
  perform 1 from public.runs where id = p_run_id for update;
  select count(*), count(*) filter (where j.status in ('queued', 'running')),
         count(*) filter (where a.status in ('ok', 'no_overview')), count(*) filter (where a.status = 'failed'),
         coalesce(sum(a.cost_usd), 0)
  into total, open_n, ok_n, fail_n, cost
  from public.run_jobs j
  left join public.answers a
    on a.job_id = j.id
  where j.run_id = p_run_id;
  update public.runs
  set jobs_total = total, jobs_ok = ok_n, jobs_failed = fail_n, cost_usd = cost,
      status = case when open_n > 0 then case when status = 'queued' and ok_n + fail_n = 0 then 'queued' else 'running' end
                    when ok_n = 0 then 'failed'
                    when fail_n = 0 then 'complete'
                    else 'partial' end,
      finished_at = case when open_n = 0 then coalesce(finished_at, now()) end
  where id = p_run_id;
end;
$$;

-- Redefined from 0011: stores job_id, and the inline question text for free-audit jobs.
create or replace function private.complete_job(p_job_id uuid, p_answer jsonb, p_citations jsonb, p_final text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.run_jobs;
  q public.questions;
  st text := p_answer ->> 'status';
  aid uuid;
begin
  select * into j from public.run_jobs where id = p_job_id for update;
  if not found or j.status in ('done', 'failed') then
    return;
  end if;
  if st is null or st not in ('ok', 'failed', 'no_overview') then
    raise exception 'Answer status must be ok, failed or no_overview' using errcode = 'invalid_parameter_value';
  end if;
  perform 1 from public.runs where id = j.run_id for update;
  select * into q from public.questions where id = j.question_id;

  insert into public.answers (run_id, job_id, question_id, engine, run_index, status, text, question_text_used,
                              location_used, location_supported, mentioned, first_position, brands,
                              cost_usd, raw, checked_at)
  values (j.run_id, j.id, j.question_id, j.engine, j.run_index, st, p_answer ->> 'text',
          coalesce(p_answer ->> 'question_text_used',
                   case when q.id is null then j.question_text
                        when q.active_form = 'long' then coalesce(q.long_text, q.short_text) else q.short_text end),
          p_answer ->> 'location_used', p_answer ->> 'location_supported',
          (p_answer ->> 'mentioned')::boolean, (p_answer ->> 'first_position')::int, p_answer -> 'brands',
          coalesce((p_answer ->> 'cost_usd')::numeric, 0), p_answer -> 'raw',
          coalesce((p_answer ->> 'checked_at')::timestamptz, now()))
  returning id into aid;

  insert into public.citations (answer_id, url, domain, title, position, category)
  select aid, c.url, c.domain, c.title, c.position, c.category
  from jsonb_to_recordset(coalesce(p_citations, '[]'))
    as c(url text, domain text, title text, position int, category text)
  on conflict (answer_id, url) do nothing;

  update public.run_jobs
  set status = p_final, locked_at = null,
      last_error = case when st = 'failed' then left(p_answer ->> 'error', 1000) else last_error end
  where id = j.id;

  perform private.recompute_run(j.run_id);
end;
$$;

-- Redefined from 0011: free-audit jobs first, with inline question/location and snapshot brands.
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

-- Starts a free audit for a stored lead: the run (10 jobs per question, 3/3/3/1), its jobs, the
-- brand snapshot and leads.run_id, in one transaction. Service role only. A lead that already
-- has a run gets that run back.
create function public.create_free_audit(p jsonb) returns uuid
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

revoke all on function public.create_free_audit(jsonb) from public, anon, authenticated;
