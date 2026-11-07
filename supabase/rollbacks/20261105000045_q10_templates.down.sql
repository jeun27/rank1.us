-- Reverts 20261105000045_q10_templates.sql: the 12 rows go, and vertical is restaurant-only again.
delete from public.question_templates where origin like 'Onboarding v2 Q10%';
alter table public.question_templates drop constraint if exists question_templates_vertical_check;
alter table public.question_templates add constraint question_templates_vertical_check check (vertical in ('restaurant'));
