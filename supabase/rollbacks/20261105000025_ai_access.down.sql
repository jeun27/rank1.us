-- Reverts 20261105000025_ai_access.sql. Stored checks are dropped; R16 is removed with its fixes.
drop function if exists public.record_ai_access_check(uuid, jsonb);
drop table if exists public.ai_access_checks;
delete from public.fix_checks where rule_key = 'R16';
delete from public.fixes where rule_key = 'R16';
delete from public.fix_rules where key = 'R16';
alter table public.fix_rules drop constraint if exists fix_rules_key_check;
alter table public.fix_rules add constraint fix_rules_key_check check (key ~ '^(A[1-6]|R([1-9]|1[0-5])|H1)$');
