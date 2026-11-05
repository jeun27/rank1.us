-- Reverts 20261105000004_work.sql
drop table if exists public.reports;
drop table if exists public.experiment_questions;
drop table if exists public.experiments;
drop table if exists public.fixes;
drop function if exists private.is_question_member(uuid);
drop function if exists private.is_experiment_member(uuid);
