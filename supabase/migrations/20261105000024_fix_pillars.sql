-- G5: a pillar (p0..p6) on every fix rule and fix, for the grouped Fix list. Additive: fixes take
-- their rule's pillar in a trigger, so live v0.5.0's inserts (which send none) still get one.
-- Rollback: supabase/rollbacks/20261105000024_fix_pillars.down.sql

-- The lead's mapping (2026-11-06): p5 crawl/read access, p3 listings/reviews/the web naming you,
-- p2 own pages and housekeeping (H1 stays a tidy-up), p1 answer rules. Anything new: p2.
create or replace function private.rule_pillar(k text) returns text
language sql immutable set search_path = '' as $$
  select case
    when k in ('R10', 'R14', 'R16') then 'p5'
    when k in ('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R12', 'R13', 'R15') then 'p3'
    when k ~ '^A[0-9]+$' then 'p1'
    else 'p2'
  end;
$$;
revoke all on function private.rule_pillar(text) from public;

alter table public.fix_rules add column if not exists pillar text;
update public.fix_rules set pillar = private.rule_pillar(key) where pillar is null;
alter table public.fix_rules alter column pillar set not null;
alter table public.fix_rules drop constraint if exists fix_rules_pillar_check;
alter table public.fix_rules add constraint fix_rules_pillar_check check (pillar ~ '^p[0-6]$');

-- A rule inserted without a pillar (the seed, a new rule) gets the mapping's.
create or replace function private.fill_rule_pillar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.pillar := coalesce(new.pillar, private.rule_pillar(new.key));
  return new;
end;
$$;
revoke all on function private.fill_rule_pillar() from public;
drop trigger if exists fix_rules_fill_pillar on public.fix_rules;
create trigger fix_rules_fill_pillar before insert on public.fix_rules
  for each row execute function private.fill_rule_pillar();

alter table public.fixes add column if not exists pillar text;
update public.fixes f set pillar = r.pillar from public.fix_rules r where r.key = f.rule_key and f.pillar is null;
alter table public.fixes alter column pillar set not null;
alter table public.fixes drop constraint if exists fixes_pillar_check;
alter table public.fixes add constraint fixes_pillar_check check (pillar ~ '^p[0-6]$');

-- A fix always has its rule's pillar (set on insert and when its rule changes).
create or replace function private.fill_fix_pillar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select r.pillar into new.pillar from public.fix_rules r where r.key = new.rule_key;
  return new;
end;
$$;
revoke all on function private.fill_fix_pillar() from public;
drop trigger if exists fixes_fill_pillar on public.fixes;
create trigger fixes_fill_pillar before insert or update of rule_key on public.fixes
  for each row execute function private.fill_fix_pillar();
