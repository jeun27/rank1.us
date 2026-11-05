-- Reverts 20261105000015_team_read.sql: write helpers back to membership-only, team read policies removed.
create or replace function private.can_write_competitors(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b and (bz.service = 'self_serve' or private.is_team())
      and private.is_business_member(bz.id)
  );
$$;


create or replace function private.can_write_fixes(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b and (bz.service = 'self_serve' or private.is_team())
      and private.is_business_member(bz.id)
  );
$$;


drop policy if exists fix_checks_team_read on public.fix_checks;
drop policy if exists fixes_team_read on public.fixes;
drop policy if exists citations_team_read on public.citations;
drop policy if exists answers_team_read on public.answers;
drop policy if exists runs_team_read on public.runs;
drop policy if exists questions_team_read on public.questions;
drop policy if exists competitors_team_read on public.competitors;
drop policy if exists businesses_team_read on public.businesses;
drop function if exists private.team_can_read_answer(uuid);
drop function if exists private.team_can_read_run(uuid);
drop function if exists private.is_team_dfy_business(uuid);
