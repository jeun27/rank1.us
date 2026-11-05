-- Step 11: the Rank1 team reads (and, per lead O1, writes fixes and competitors of) every DFY
-- business, across workspaces, without being a member. Self-serve data stays private.
-- Additive and re-runnable in one transaction. Rollback: supabase/rollbacks/20261105000015_team_read.down.sql

create or replace function private.is_team_dfy_business(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_team() and exists (select 1 from public.businesses bz where bz.id = b and bz.service = 'dfy');
$$;

create or replace function private.team_can_read_run(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_team() and exists (
    select 1 from public.runs ru
    join public.businesses bz on bz.id = ru.business_id
    where ru.id = r and ru.kind <> 'free_audit' and bz.service = 'dfy'
  );
$$;

create or replace function private.team_can_read_answer(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.answers an where an.id = a and private.team_can_read_run(an.run_id));
$$;

revoke all on function private.is_team_dfy_business(uuid), private.team_can_read_run(uuid),
  private.team_can_read_answer(uuid) from public;
grant execute on function private.is_team_dfy_business(uuid), private.team_can_read_run(uuid),
  private.team_can_read_answer(uuid) to authenticated;

-- Extra SELECT policies, OR'd with the existing member policies (which are unchanged).
drop policy if exists businesses_team_read on public.businesses;
create policy businesses_team_read on public.businesses for select to authenticated
  using (private.is_team() and service = 'dfy');
drop policy if exists competitors_team_read on public.competitors;
create policy competitors_team_read on public.competitors for select to authenticated
  using (private.is_team_dfy_business(business_id));
drop policy if exists questions_team_read on public.questions;
create policy questions_team_read on public.questions for select to authenticated
  using (private.is_team_dfy_business(business_id));
drop policy if exists runs_team_read on public.runs;
create policy runs_team_read on public.runs for select to authenticated
  using (private.team_can_read_run(id));
drop policy if exists answers_team_read on public.answers;
create policy answers_team_read on public.answers for select to authenticated
  using (private.team_can_read_run(run_id));
drop policy if exists citations_team_read on public.citations;
create policy citations_team_read on public.citations for select to authenticated
  using (private.team_can_read_answer(answer_id));
drop policy if exists fixes_team_read on public.fixes;
create policy fixes_team_read on public.fixes for select to authenticated
  using (private.is_team_dfy_business(business_id));
drop policy if exists fix_checks_team_read on public.fix_checks;
create policy fix_checks_team_read on public.fix_checks for select to authenticated
  using (private.is_team_dfy_business(business_id));

-- Lead O1: writes follow the same rule. Self-serve members write their own business; any team
-- user writes any DFY business. A dfy_client never writes.
create or replace function private.can_write_fixes(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b
      and ((bz.service = 'self_serve' and private.is_business_member(bz.id)) or (private.is_team() and bz.service = 'dfy'))
  );
$$;

create or replace function private.can_write_competitors(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b
      and ((bz.service = 'self_serve' and private.is_business_member(bz.id)) or (private.is_team() and bz.service = 'dfy'))
  );
$$;
