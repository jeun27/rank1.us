-- Reverts 20261105000014_fix_results.sql. Fixes with no answer count get 0 back.
drop function if exists public.set_fix_status(uuid, text);
drop function if exists public.runs_needing_fix_checks(int);
drop function if exists public.record_fix_results(uuid, uuid, jsonb);
drop table if exists public.fix_checks;
drop index if exists public.fixes_open_rule_key;
update public.fixes set affected_answers = 0 where affected_answers is null;
alter table public.fixes alter column affected_answers set default 0, alter column affected_answers set not null;
delete from public.fixes where rule_key in ('A1', 'A2', 'A3', 'A4', 'A5', 'A6');
delete from public.fix_rules where key in ('A1', 'A2', 'A3', 'A4', 'A5', 'A6');
