-- G7 "Lists that name your rivals but not you": candidates are computed on read from stored
-- citations (data-pipeline); only users' decisions are stored. Plus fix rule R17 (grouped). Additive.
-- Rollback: supabase/rollbacks/20261105000030_mention_decisions.down.sql

create table if not exists public.mention_target_decisions (
  business_id uuid not null references public.businesses (id) on delete cascade,
  url text not null check (url ~* '^https?://[^\s]+$' and char_length(url) <= 2000),
  status text not null check (status in ('added', 'dismissed')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz not null default now(),
  primary key (business_id, url)
);
create index if not exists mention_target_decisions_decided_by_idx on public.mention_target_decisions (decided_by);

-- Read: members (incl. the dfy_client) and the team on DFY. Written only by set_mention_target.
alter table public.mention_target_decisions enable row level security;
revoke all on table public.mention_target_decisions from anon, authenticated;
grant select on table public.mention_target_decisions to authenticated;
drop policy if exists mention_target_decisions_read on public.mention_target_decisions;
create policy mention_target_decisions_read on public.mention_target_decisions for select to authenticated
  using (private.is_business_member(business_id) or private.is_team_dfy_business(business_id));

-- "Add to fixes" / "Not relevant" on a candidate page, or null to clear. Self-serve members or the
-- team on DFY (can_write_business; never a dfy_client). 22023 bad URL or status, 42501 not allowed.
create or replace function public.set_mention_target(p_business_id uuid, p_url text, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u text := btrim(p_url);
begin
  if not private.can_write_business(p_business_id) then
    raise exception 'Not allowed to change this business' using errcode = 'insufficient_privilege';
  end if;
  if u is null or u !~* '^https?://[^\s]+$' or char_length(u) > 2000 then
    raise exception 'The page must be an http or https URL' using errcode = 'invalid_parameter_value';
  end if;
  if p_status is null then
    delete from public.mention_target_decisions where business_id = p_business_id and url = u;
  elsif p_status in ('added', 'dismissed') then
    insert into public.mention_target_decisions (business_id, url, status, decided_by, decided_at)
    values (p_business_id, u, p_status, auth.uid(), now())
    on conflict (business_id, url) do update
      set status = excluded.status, decided_by = excluded.decided_by, decided_at = excluded.decided_at;
  else
    raise exception 'Status must be added, dismissed or null' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;
revoke all on function public.set_mention_target(uuid, text, text) from public, anon;
grant execute on function public.set_mention_target(uuid, text, text) to authenticated;

-- R17, the one grouped "Get on these lists" fix (U7), in p3 (0024's mapping gains it).
create or replace function private.rule_pillar(k text) returns text
language sql immutable set search_path = '' as $$
  select case
    when k in ('R10', 'R14', 'R16') then 'p5'
    when k in ('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R12', 'R13', 'R15', 'R17') then 'p3'
    when k ~ '^A[0-9]+$' then 'p1'
    else 'p2'
  end;
$$;
alter table public.fix_rules drop constraint if exists fix_rules_key_check;
alter table public.fix_rules add constraint fix_rules_key_check check (key ~ '^(A[1-6]|R([1-9]|1[0-7])|H1)$');
insert into public.fix_rules (key, grp, title, size, detection, data_source, cadence, threshold, unverified,
                              customer_copy, why_note, ai_lever, enabled)
values ('R17', 'restaurant', 'Get on these lists', 'M',
        'Pages cited in answers that name a competitor but not the business, that a member or the team added (mention_target_decisions, status added).',
        'Stored citations + mention_target_decisions', 'weekly', null, '{}'::text[],
        '{n} lists AI cites name {rivals} but not you.',
        'Grouped by design (lead U7): one fix holds every added page. No effect claim.', true, true)
on conflict (key) do nothing;
