-- Reverts 20261105000002_reference.sql
drop view if exists public.fix_rules_public;
drop table if exists public.local_places;
drop table if exists public.question_templates;
drop table if exists public.fix_rules;
drop table if exists public.domain_categories;
