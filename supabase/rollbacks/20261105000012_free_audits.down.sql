-- Reverts 20261105000012_free_audits.sql. Free-audit jobs can't exist without inline questions,
-- so they are removed before question_id becomes required again.
drop function if exists public.create_free_audit(jsonb);

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

  perform private.recompute_run(j.run_id);
end;
$$;

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
    on a.run_id = j.run_id and a.question_id = j.question_id and a.engine = j.engine and a.run_index = j.run_index
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
  insert into public.run_jobs (run_id, question_id, engine, run_index)
  select rid, q.id, e.engine, i
  from public.questions q
  cross join (values ('chatgpt', 3), ('gemini', 3), ('google_aio', 3), ('perplexity', 1)) as e(engine, runs)
  cross join lateral generate_series(1, e.runs) as i
  where q.business_id = b.id and q.active;
  return rid;
end;
$$;

drop table if exists public.free_audits;
drop index if exists public.answers_job_id_key;
alter table public.answers drop column if exists job_id;
delete from public.run_jobs where question_id is null;
alter table public.run_jobs
  drop constraint if exists run_jobs_location_level_check,
  drop constraint if exists run_jobs_inline_question_check,
  drop constraint if exists run_jobs_question_by_kind_check,
  drop constraint if exists run_jobs_run_kind_fkey,
  drop column if exists dfs_location_code,
  drop column if exists city,
  drop column if exists state,
  drop column if exists country,
  drop column if exists location_level,
  drop column if exists question_text,
  drop column if exists run_kind,
  alter column question_id set not null;
alter table public.runs drop constraint if exists runs_id_kind_key;
