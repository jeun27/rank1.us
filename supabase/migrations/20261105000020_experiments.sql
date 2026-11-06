-- Step 17: before/after test vs control. Self-serve members and the team on DFY read and write
-- experiments; a dfy_client never sees them. Additive and re-runnable.
-- Rollback: supabase/rollbacks/20261105000020_experiments.down.sql

alter table public.experiments
  add column if not exists ended_at timestamptz,
  alter column status set default 'running';
alter table public.experiments drop constraint if exists experiments_status_check;
alter table public.experiments add constraint experiments_status_check
  check (status in ('running', 'ended')) not valid;
alter table public.experiments drop constraint if exists experiments_change_url_check;
alter table public.experiments add constraint experiments_change_url_check
  check (change_url is null or (change_url ~* '^https?://[^\s]+$' and char_length(change_url) <= 2000)) not valid;

create or replace function private.is_experiment_writer(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.experiments ex where ex.id = e and private.can_write_business(ex.business_id));
$$;
revoke all on function private.is_experiment_writer(uuid) from public;
grant execute on function private.is_experiment_writer(uuid) to authenticated;

-- Reads and writes follow private.can_write_business (0019). Rows are never updated through the
-- API: end_experiment is the only change, and group membership is fixed at creation.
drop policy if exists experiments_member on public.experiments;
drop policy if exists experiments_select on public.experiments;
drop policy if exists experiments_insert on public.experiments;
drop policy if exists experiments_delete on public.experiments;
create policy experiments_select on public.experiments for select to authenticated
  using (private.can_write_business(business_id));
create policy experiments_insert on public.experiments for insert to authenticated
  with check (private.can_write_business(business_id));
create policy experiments_delete on public.experiments for delete to authenticated
  using (private.can_write_business(business_id));
revoke update on table public.experiments from authenticated;

drop policy if exists experiment_questions_member on public.experiment_questions;
drop policy if exists experiment_questions_select on public.experiment_questions;
drop policy if exists experiment_questions_insert on public.experiment_questions;
create policy experiment_questions_select on public.experiment_questions for select to authenticated
  using (private.is_experiment_writer(experiment_id));
create policy experiment_questions_insert on public.experiment_questions for insert to authenticated
  with check (private.is_experiment_writer(experiment_id));
revoke update, delete on table public.experiment_questions from authenticated;

-- Group rules, checked at commit after any insert: both groups have a question, every question
-- and the fix belong to the experiment's business, and the change date isn't in the future.
-- (The primary key keeps a question in one group.) Deletes (question removed) are not checked.
create or replace function private.check_experiment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ex public.experiments;
begin
  select * into ex from public.experiments
  where id = case when tg_table_name = 'experiments' then new.id else new.experiment_id end;
  if not found then
    return null;
  end if;
  if not exists (select 1 from public.experiment_questions where experiment_id = ex.id and grp = 'test')
     or not exists (select 1 from public.experiment_questions where experiment_id = ex.id and grp = 'control') then
    raise exception 'An experiment needs at least one test and one control question' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.experiment_questions eq join public.questions q on q.id = eq.question_id
             where eq.experiment_id = ex.id and q.business_id <> ex.business_id) then
    raise exception 'Experiment questions must belong to its business' using errcode = 'check_violation';
  end if;
  if ex.fix_id is not null and not exists (select 1 from public.fixes where id = ex.fix_id and business_id = ex.business_id) then
    raise exception 'The fix must belong to the experiment''s business' using errcode = 'check_violation';
  end if;
  if ex.change_date > (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'The change date can''t be in the future' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;
revoke all on function private.check_experiment() from public;

drop trigger if exists experiments_check on public.experiments;
create constraint trigger experiments_check after insert on public.experiments
  deferrable initially deferred for each row execute function private.check_experiment();
drop trigger if exists experiment_questions_check on public.experiment_questions;
create constraint trigger experiment_questions_check after insert on public.experiment_questions
  deferrable initially deferred for each row execute function private.check_experiment();

-- Creates an experiment with its groups. p = {business_id, test[], control[]?, fix_id?, name?,
-- change_note?, change_url?, change_date?}. Control defaults to the business's other active
-- questions, name to the fix title, change_date to today in LA. 22023 bad input, 42501 refused.
create or replace function public.create_experiment(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  b uuid;
  fx uuid;
  tst uuid[];
  ctl uuid[];
  nm text := nullif(btrim(p ->> 'name'), '');
  note text := nullif(btrim(p ->> 'change_note'), '');
  url text := nullif(btrim(p ->> 'change_url'), '');
  dt date;
  today date := (now() at time zone 'America/Los_Angeles')::date;
  fix_title text;
  new_id uuid;
begin
  begin
    b := (p ->> 'business_id')::uuid;
    fx := nullif(p ->> 'fix_id', '')::uuid;
    dt := coalesce(nullif(p ->> 'change_date', '')::date, today);
    tst := array(select distinct x::uuid from jsonb_array_elements_text(coalesce(p -> 'test', '[]')) as t(x));
    if p ? 'control' and jsonb_typeof(p -> 'control') <> 'null' then
      ctl := array(select distinct x::uuid from jsonb_array_elements_text(p -> 'control') as t(x));
    end if;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
                 or invalid_parameter_value then
    raise exception 'Bad experiment input' using errcode = 'invalid_parameter_value';
  end;
  if b is null or not private.can_write_business(b) then
    raise exception 'Not allowed to change this business' using errcode = 'insufficient_privilege';
  end if;
  if fx is not null then
    select f.title into fix_title from public.fixes f where f.id = fx and f.business_id = b;
    if not found then
      raise exception 'Unknown fix' using errcode = 'invalid_parameter_value';
    end if;
    nm := coalesce(nm, btrim(fix_title));
  end if;
  if nm is null or char_length(nm) > 200 then
    raise exception 'Name is required (at most 200 characters)' using errcode = 'invalid_parameter_value';
  end if;
  if note is not null and char_length(note) > 2000 then
    raise exception 'What changed is at most 2000 characters' using errcode = 'invalid_parameter_value';
  end if;
  if url is not null and (url !~* '^https?://[^\s]+$' or char_length(url) > 2000) then
    raise exception 'The link must start with http:// or https://' using errcode = 'invalid_parameter_value';
  end if;
  if dt > today then
    raise exception 'The change date can''t be in the future' using errcode = 'invalid_parameter_value';
  end if;
  if ctl is null then
    ctl := array(select q.id from public.questions q where q.business_id = b and q.active and q.id <> all (tst));
  end if;
  if cardinality(tst) = 0 or cardinality(ctl) = 0 then
    raise exception 'Pick at least one test and one control question' using errcode = 'invalid_parameter_value';
  end if;
  if tst && ctl then
    raise exception 'A question can be in one group only' using errcode = 'invalid_parameter_value';
  end if;
  if (select count(*) from public.questions q where q.business_id = b and q.id = any (tst || ctl))
     <> cardinality(tst) + cardinality(ctl) then
    raise exception 'Questions must belong to this business' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.experiments (business_id, fix_id, name, change_note, change_url, change_date, status)
  values (b, fx, nm, note, url, dt, 'running')
  returning id into new_id;
  insert into public.experiment_questions (experiment_id, question_id, grp)
  select new_id, x, 'test' from unnest(tst) as x
  union all select new_id, x, 'control' from unnest(ctl) as x;
  return new_id;
end;
$$;

-- Ends a running experiment early. False when it isn't running or the caller can't change it.
create or replace function public.end_experiment(p_experiment_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.experiments set status = 'ended', ended_at = now()
  where id = p_experiment_id and coalesce(status, 'running') = 'running' and private.can_write_business(business_id);
  return found;
end;
$$;

-- Per group and window: ok answers (named, n) of the group's questions in audit/weekly runs,
-- counted like run_summaries. Windows on the LA date of runs.started_at: before [d-28, d),
-- after [d, d+28), cut after the LA date of ended_at. No rows when the caller can't read it.
create or replace function public.experiment_data(p_experiment_id uuid)
returns table (grp text, period text, starts date, ends date, named int, n int)
language sql stable security invoker set search_path = '' as $$
  with ex as (
    select e.id, e.business_id, e.change_date as d,
           least(e.change_date + 28,
                 coalesce((e.ended_at at time zone 'America/Los_Angeles')::date + 1, e.change_date + 28)) as after_end
    from public.experiments e
    where e.id = p_experiment_id and e.change_date is not null
  ), w as (
    select g.grp, v.period, v.starts, v.ends
    from ex
    cross join (values ('test'), ('control')) as g(grp)
    cross join lateral (values ('before', ex.d - 28, ex.d), ('after', ex.d, greatest(ex.after_end, ex.d)))
      as v(period, starts, ends)
  ), c as (
    select eq.grp, (ru.started_at at time zone 'America/Los_Angeles')::date as day,
           count(*)::int as n, (count(*) filter (where an.mentioned))::int as named
    from ex
    join public.experiment_questions eq on eq.experiment_id = ex.id
    join public.answers an on an.question_id = eq.question_id and an.status = 'ok'
    join public.runs ru on ru.id = an.run_id and ru.business_id = ex.business_id and ru.kind in ('audit', 'weekly')
    group by eq.grp, day
  )
  select w.grp, w.period, w.starts, w.ends,
         coalesce(sum(c.named), 0)::int, coalesce(sum(c.n), 0)::int
  from w
  left join c on c.grp = w.grp and c.day >= w.starts and c.day < w.ends
  group by w.grp, w.period, w.starts, w.ends
  order by w.grp desc, w.period desc;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.create_experiment(jsonb), public.end_experiment(uuid),
  public.experiment_data(uuid) from public, anon;
grant execute on function public.create_experiment(jsonb), public.end_experiment(uuid),
  public.experiment_data(uuid) to authenticated;
