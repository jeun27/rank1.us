-- Reverts 20261105000024_fix_pillars.sql. The pillar columns and their values are dropped.
drop trigger if exists fixes_fill_pillar on public.fixes;
drop function if exists private.fill_fix_pillar();
alter table public.fixes drop constraint if exists fixes_pillar_check;
alter table public.fixes drop column if exists pillar;

drop trigger if exists fix_rules_fill_pillar on public.fix_rules;
drop function if exists private.fill_rule_pillar();
alter table public.fix_rules drop constraint if exists fix_rules_pillar_check;
alter table public.fix_rules drop column if exists pillar;
drop function if exists private.rule_pillar(text);
