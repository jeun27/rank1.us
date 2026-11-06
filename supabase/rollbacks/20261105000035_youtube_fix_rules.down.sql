-- Reverts 20261105000035_youtube_fix_rules.sql. R19-R21 are removed with their fixes; the key check
-- and the pillar map go back to their 0031 versions.
delete from public.fix_checks where rule_key in ('R19', 'R20', 'R21');
delete from public.fixes where rule_key in ('R19', 'R20', 'R21');
delete from public.fix_rules where key in ('R19', 'R20', 'R21');
alter table public.fix_rules drop constraint if exists fix_rules_key_check;
alter table public.fix_rules add constraint fix_rules_key_check check (key ~ '^(A[1-6]|R([1-9]|1[0-8])|H1)$');
create or replace function private.rule_pillar(k text) returns text
language sql immutable set search_path = '' as $$
  select case
    when k in ('R10', 'R14', 'R16', 'R18') then 'p5'
    when k in ('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R12', 'R13', 'R15', 'R17') then 'p3'
    when k ~ '^A[0-9]+$' then 'p1'
    else 'p2'
  end;
$$;
