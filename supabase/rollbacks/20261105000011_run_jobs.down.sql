-- Reverts 20261105000011_run_jobs.sql
drop function if exists public.claim_jobs(int);
drop function if exists public.job_error(uuid, text);
drop function if exists public.finish_job(uuid, jsonb, jsonb);
drop function if exists private.complete_job(uuid, jsonb, jsonb, text);
drop function if exists public.create_run(uuid, text);
drop index if exists public.citations_answer_id_url_key;
drop table if exists public.run_jobs;
