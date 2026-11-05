-- Step 6: run orchestration. A Supabase jobs table polled by Vercel Cron (the pack's fallback).
-- Rollback: supabase/rollbacks/20261105000011_run_jobs.down.sql

create table public.run_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  engine text not null check (engine in ('chatgpt', 'gemini', 'google_aio', 'perplexity')),
  run_index int not null check (run_index between 1 and 3),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts int not null default 0,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (run_id, question_id, engine, run_index)
);
create index run_jobs_status_locked_at_idx on public.run_jobs (status, locked_at);
create index run_jobs_question_id_idx on public.run_jobs (question_id);
alter table public.run_jobs enable row level security;
revoke all on table public.run_jobs from anon, authenticated;

-- Safety net for the per-answer citation dedupe (the worker normalizes URLs first).
create unique index citations_answer_id_url_key on public.citations (answer_id, url);

-- Starts a run: 10 jobs per active question (ChatGPT x3, Gemini x3, Google AIO x3, Perplexity x1).
-- Paid workspaces (active/trialing) or DFY businesses only, one queued/running run per business.
create function public.create_run(p_business_id uuid, p_kind text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  b public.businesses;
  sub text;
  n int;
  rid uuid;
begin
  if p_kind is null or p_kind not in ('audit', 'weekly') then
    raise exception 'Run kind must be audit or weekly' using errcode = 'invalid_parameter_value';
  end if;
  select * into b from public.businesses where id = p_business_id for update;
  if not found or (coalesce(auth.role(), '') <> 'service_role' and not private.is_business_member(b.id)) then
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
  select count(*) into n from public.questions where business_id = b.id and active;
  if n = 0 then
    raise exception 'Business has no active questions' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.runs (business_id, kind, status, jobs_total, started_at)
  values (b.id, p_kind, 'queued', n * 10, now())
  returning id into rid;
  insert into public.run_jobs (run_id, question_id, engine, run_index)
  select rid, q.id, e.engine, i
  from public.questions q
  cross join (values ('chatgpt', 3), ('gemini', 3), ('google_aio', 3), ('perplexity', 1)) as e(engine, runs)
  cross join lateral generate_series(1, e.runs) as i
  where q.business_id = b.id and q.active;
  return rid;
end;
$$;

-- Stores one job's answer (and citations), sets the job's final status, then recomputes the
-- run's counts and status from its answers. The run row lock serializes recomputes per run.
create function private.complete_job(p_job_id uuid, p_answer jsonb, p_citations jsonb, p_final text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.run_jobs;
  q public.questions;
  st text := p_answer ->> 'status';
  aid uuid;
  ok_n int;
  fail_n int;
  cost numeric;
begin
  select * into j from public.run_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Unknown job %', p_job_id using errcode = 'invalid_parameter_value';
  end if;
  if j.status in ('done', 'failed') then
    return;
  end if;
  if st is null or st not in ('ok', 'failed', 'no_overview') then
    raise exception 'Answer status must be ok, failed or no_overview' using errcode = 'invalid_parameter_value';
  end if;
  perform 1 from public.runs where id = j.run_id for update;
  select * into q from public.questions where id = j.question_id;

  insert into public.answers (run_id, question_id, engine, run_index, status, text, question_text_used,
                              location_used, location_supported, mentioned, first_position, brands,
                              cost_usd, raw, checked_at)
  values (j.run_id, j.question_id, j.engine, j.run_index, st, p_answer ->> 'text',
          coalesce(p_answer ->> 'question_text_used',
                   case when q.active_form = 'long' then coalesce(q.long_text, q.short_text) else q.short_text end),
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

  select count(*) filter (where status in ('ok', 'no_overview')), count(*) filter (where status = 'failed'),
         coalesce(sum(cost_usd), 0)
  into ok_n, fail_n, cost
  from public.answers where run_id = j.run_id;
  update public.runs
  set jobs_ok = ok_n, jobs_failed = fail_n, cost_usd = cost,
      status = case when ok_n + fail_n < jobs_total then 'running'
                    when fail_n = 0 then 'complete'
                    when ok_n = 0 then 'failed'
                    else 'partial' end,
      finished_at = case when ok_n + fail_n >= jobs_total then coalesce(finished_at, now()) end
  where id = j.run_id;
end;
$$;

-- Worker result for one claimed job. Idempotent: a job that is already done is left alone.
create function public.finish_job(p_job_id uuid, p_answer jsonb, p_citations jsonb) returns void
language sql security definer set search_path = '' as $$
  select private.complete_job(p_job_id, p_answer, p_citations, 'done');
$$;

-- Records a worker error on a job without finishing it (for example when finish_job itself failed).
create function public.job_error(p_job_id uuid, p_error text) returns void
language sql security definer set search_path = '' as $$
  update public.run_jobs set last_error = left(p_error, 1000) where id = p_job_id;
$$;

-- Claims up to p_limit jobs: queued ones, or running ones locked over 10 minutes ago.
-- A stale job at 3 attempts is closed with a failed answer instead, so it counts as failed.
create function public.claim_jobs(p_limit int) returns setof jsonb
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
    order by created_at, id
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
    'question', jsonb_build_object(
      'id', q.id,
      'text', case when q.active_form = 'long' then coalesce(q.long_text, q.short_text) else q.short_text end,
      'location_level', q.location_level,
      'country', coalesce(q.country, b.country),
      'state', case when q.location_level in ('state', 'city') then coalesce(q.state, b.state) end,
      'city', case when q.location_level = 'city' then coalesce(q.city, b.city) end,
      'dfs_location_code', q.dfs_location_code),
    'business', jsonb_build_object('id', b.id, 'name', b.name, 'aliases', to_jsonb(b.aliases), 'domain', b.domain),
    'competitors', coalesce((
      select jsonb_agg(jsonb_build_object('id', co.id, 'name', co.name, 'aliases', to_jsonb(co.aliases), 'domain', co.domain)
                       order by co.name)
      from public.competitors co where co.business_id = b.id and not co.hidden), '[]'))
  from claimed c
  join public.questions q on q.id = c.question_id
  join public.businesses b on b.id = q.business_id
  order by c.created_at, c.id;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default. The worker functions are
-- service role only; create_run is also for signed-in members.
revoke all on function public.create_run(uuid, text), public.finish_job(uuid, jsonb, jsonb),
  public.job_error(uuid, text), public.claim_jobs(int) from public, anon, authenticated;
grant execute on function public.create_run(uuid, text) to authenticated;
revoke all on function private.complete_job(uuid, jsonb, jsonb, text) from public;
