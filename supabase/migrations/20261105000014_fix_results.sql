-- Step 10: what to fix next. A1-A6 placeholders, per-run fix checks, recording detector results
-- and setting fix status. Additive and re-runnable in one transaction.
-- Rollback: supabase/rollbacks/20261105000014_fix_results.down.sql

-- A1-A6 (answer-derived rules): the Build Pack text isn't available, so they're disabled internal
-- placeholders. Disabled rules never produce fixes, so this text is never rendered.
insert into public.fix_rules (key, grp, title, size, detection, cadence, unverified, customer_copy, why_note, ai_lever, enabled)
select k, 'answers', 'PENDING: Build Pack Step 10', 'M', 'PENDING: Build Pack Step 10', 'weekly',
       array['PENDING: Build Pack Step 10'], 'PENDING: Build Pack Step 10', 'PENDING: Build Pack Step 10', true, false
from unnest(array['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) as k
on conflict (key) do nothing;

-- Site rules have no answer count, so it may be null (the UI hides it then).
alter table public.fixes alter column affected_answers drop not null, alter column affected_answers drop default;

-- One open fix per rule per business.
create unique index if not exists fixes_open_rule_key on public.fixes (business_id, rule_key) where status <> 'done';

-- One row per rule checked on a run: which rules were fixed, ok or couldn't be checked.
-- Also the once-per-run marker for the cron drain.
create table if not exists public.fix_checks (
  run_id uuid not null references public.runs (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  rule_key text not null references public.fix_rules (key),
  result text not null check (result in ('fix', 'ok', 'unchecked')),
  created_at timestamptz not null default now(),
  primary key (run_id, rule_key)
);
create index if not exists fix_checks_business_id_created_at_idx on public.fix_checks (business_id, created_at desc);
create index if not exists fix_checks_rule_key_idx on public.fix_checks (rule_key);
alter table public.fix_checks enable row level security;
revoke all on table public.fix_checks from anon, authenticated;
grant select on table public.fix_checks to authenticated;
drop policy if exists fix_checks_select on public.fix_checks;
create policy fix_checks_select on public.fix_checks for select to authenticated
  using (private.can_see_fix_list(business_id));

-- Stores one closed paid run's detector results, service role only, in one transaction:
-- 'fix' updates the open fix for the rule or opens a new todo; 'ok' closes the open fix;
-- 'unchecked' leaves fixes alone. A run already recorded is a no-op.
create or replace function public.record_fix_results(p_business_id uuid, p_run_id uuid, p_results jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.runs;
  fr public.fix_rules;
  x record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can record fix results' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.runs where id = p_run_id for update;
  if not found or r.business_id is distinct from p_business_id or r.kind not in ('audit', 'weekly')
     or r.status not in ('complete', 'partial') then
    raise exception 'Fix results need a complete or partial audit/weekly run of this business'
      using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.fix_checks where run_id = p_run_id) then
    return;
  end if;
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results) = 0
     or (select count(distinct e ->> 'rule_key') from jsonb_array_elements(p_results) e) <> jsonb_array_length(p_results) then
    raise exception 'Results must be a non-empty array with one entry per rule' using errcode = 'invalid_parameter_value';
  end if;
  perform 1 from public.businesses where id = p_business_id for update;

  for x in select * from jsonb_to_recordset(p_results) as t(rule_key text, result text, evidence jsonb, detail text) loop
    select * into fr from public.fix_rules where key = x.rule_key and enabled;
    if not found then
      raise exception 'Unknown or disabled rule %', x.rule_key using errcode = 'invalid_parameter_value';
    end if;
    if x.result is null or x.result not in ('fix', 'ok', 'unchecked') then
      raise exception 'Result must be fix, ok or unchecked' using errcode = 'invalid_parameter_value';
    end if;
    if x.result = 'fix' then
      if coalesce(btrim(x.detail), '') = '' or char_length(x.detail) > 2000 then
        raise exception 'A fix needs detail text of at most 2000 characters' using errcode = 'invalid_parameter_value';
      end if;
      update public.fixes
      set size = fr.size, title = fr.title, detail = x.detail, evidence = coalesce(x.evidence, '{}'),
          last_seen_run = p_run_id
      where business_id = p_business_id and rule_key = fr.key and status <> 'done';
      if not found then
        insert into public.fixes (business_id, rule_key, size, title, detail, evidence, affected_answers, status,
                                  first_seen_run, last_seen_run)
        values (p_business_id, fr.key, fr.size, fr.title, x.detail, coalesce(x.evidence, '{}'), null, 'todo',
                p_run_id, p_run_id);
      end if;
    elsif x.result = 'ok' then
      update public.fixes set status = 'done'
      where business_id = p_business_id and rule_key = fr.key and status <> 'done';
    end if;
    insert into public.fix_checks (run_id, business_id, rule_key, result) values (p_run_id, p_business_id, fr.key, x.result);
  end loop;
end;
$$;

-- Closed paid runs whose fix checks haven't been recorded yet, oldest finished first. Service role only.
create or replace function public.runs_needing_fix_checks(p_limit int default 1)
returns table (run_id uuid, business_id uuid, domain text)
language sql stable security definer set search_path = '' as $$
  select ru.id, ru.business_id, b.domain
  from public.runs ru
  join public.businesses b on b.id = ru.business_id
  where ru.kind in ('audit', 'weekly') and ru.status in ('complete', 'partial')
    and not exists (select 1 from public.fix_checks fc where fc.run_id = ru.id)
  order by ru.finished_at nulls last, ru.id
  limit greatest(coalesce(p_limit, 1), 0);
$$;

-- Members who may write fixes (self-serve or team) set a fix's status, through RLS.
create or replace function public.set_fix_status(p_fix_id uuid, p_status text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_status is null or p_status not in ('todo', 'doing', 'done') then
    raise exception 'Status must be todo, doing or done' using errcode = 'invalid_parameter_value';
  end if;
  update public.fixes set status = p_status where id = p_fix_id;
  if not found then
    raise exception 'Not allowed to change this fix' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.record_fix_results(uuid, uuid, jsonb), public.runs_needing_fix_checks(int)
  from public, anon, authenticated;
revoke all on function public.set_fix_status(uuid, text) from public, anon;
grant execute on function public.set_fix_status(uuid, text) to authenticated;
