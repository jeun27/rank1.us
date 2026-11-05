-- Customer work: fixes, experiments, experiment_questions, reports. Read and written by members.
-- Rollback: supabase/rollbacks/20261105000004_work.down.sql

create table public.fixes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  rule_key text not null references public.fix_rules (key),
  size text not null check (size in ('S', 'S-M', 'M', 'M-L', 'L')),
  title text not null,
  detail text,
  evidence jsonb,
  affected_answers int not null default 0,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  first_seen_run uuid references public.runs (id) on delete set null,
  last_seen_run uuid references public.runs (id) on delete set null
);
create index fixes_business_id_idx on public.fixes (business_id);
create index fixes_rule_key_idx on public.fixes (rule_key);
create index fixes_first_seen_run_idx on public.fixes (first_seen_run);
create index fixes_last_seen_run_idx on public.fixes (last_seen_run);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  fix_id uuid references public.fixes (id) on delete set null,
  name text not null,
  change_note text,
  change_url text,
  change_date date,
  status text
);
create index experiments_business_id_idx on public.experiments (business_id);
create index experiments_fix_id_idx on public.experiments (fix_id);

create table public.experiment_questions (
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  grp text not null check (grp in ('test', 'control')),
  primary key (experiment_id, question_id)
);
create index experiment_questions_question_id_idx on public.experiment_questions (question_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pdf_path text,
  sent_to text[] not null default '{}',
  sent_at timestamptz,
  status text
);
create index reports_business_id_idx on public.reports (business_id);

create function private.is_experiment_member(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.experiments ex where ex.id = e and private.is_business_member(ex.business_id)
  );
$$;

create function private.is_question_member(q uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.questions qu where qu.id = q and private.is_business_member(qu.business_id)
  );
$$;

revoke all on function private.is_experiment_member(uuid), private.is_question_member(uuid) from public;
grant execute on function private.is_experiment_member(uuid), private.is_question_member(uuid) to authenticated;

alter table public.fixes enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_questions enable row level security;
alter table public.reports enable row level security;

create policy fixes_member on public.fixes for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy experiments_member on public.experiments for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy experiment_questions_member on public.experiment_questions for all to authenticated
  using (private.is_experiment_member(experiment_id))
  with check (private.is_experiment_member(experiment_id) and private.is_question_member(question_id));
create policy reports_member on public.reports for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
