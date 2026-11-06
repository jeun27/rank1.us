-- Reverts 20261105000020_experiments.sql. ended_at values are dropped with the column.
drop function if exists public.experiment_data(uuid);
drop function if exists public.end_experiment(uuid);
drop function if exists public.create_experiment(jsonb);

drop trigger if exists experiment_questions_check on public.experiment_questions;
drop trigger if exists experiments_check on public.experiments;
drop function if exists private.check_experiment();

drop policy if exists experiment_questions_insert on public.experiment_questions;
drop policy if exists experiment_questions_select on public.experiment_questions;
drop policy if exists experiment_questions_member on public.experiment_questions;
create policy experiment_questions_member on public.experiment_questions for all to authenticated
  using (private.is_experiment_member(experiment_id))
  with check (private.is_experiment_member(experiment_id) and private.is_question_member(question_id));
grant update, delete on table public.experiment_questions to authenticated;

drop policy if exists experiments_delete on public.experiments;
drop policy if exists experiments_insert on public.experiments;
drop policy if exists experiments_select on public.experiments;
drop policy if exists experiments_member on public.experiments;
create policy experiments_member on public.experiments for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
grant update on table public.experiments to authenticated;
drop function if exists private.is_experiment_writer(uuid);

alter table public.experiments drop constraint if exists experiments_change_url_check;
alter table public.experiments drop constraint if exists experiments_status_check;
alter table public.experiments
  alter column status drop default,
  drop column if exists ended_at;
