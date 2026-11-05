-- Engine output: runs, answers, citations, listing_snapshots, ai_traffic.
-- Members read; only the service role writes. free_audit runs (and their answers and
-- citations) have no member read path.
-- Rollback: supabase/rollbacks/20261105000003_engine.down.sql

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('audit', 'weekly', 'free_audit')),
  status text not null default 'queued' check (status in ('queued', 'running', 'partial', 'complete', 'failed')),
  jobs_total int not null default 0,
  jobs_ok int not null default 0,
  jobs_failed int not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  check (business_id is not null or kind = 'free_audit')
);
create index runs_business_id_started_at_idx on public.runs (business_id, started_at desc);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  engine text not null check (engine in ('chatgpt', 'gemini', 'google_aio', 'perplexity')),
  run_index int not null check (run_index between 1 and 3),
  status text not null check (status in ('ok', 'failed', 'no_overview')),
  text text,
  question_text_used text not null,
  location_used text,
  location_supported text check (location_supported in ('exact', 'fallback_country')),
  mentioned boolean,
  first_position int,
  brands jsonb,
  cost_usd numeric(10, 4) not null default 0,
  raw jsonb,
  checked_at timestamptz not null default now()
);
create index answers_run_id_idx on public.answers (run_id);
create index answers_question_id_idx on public.answers (question_id);

create table public.citations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers (id) on delete cascade,
  url text not null,
  domain text not null,
  title text,
  position int,
  category text
);
create index citations_answer_id_idx on public.citations (answer_id);
create index citations_domain_idx on public.citations (domain);

create table public.listing_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  source text not null check (source in ('gbp', 'yelp', 'tripadvisor', 'booking', 'site', 'serp')),
  url text,
  data jsonb not null default '{}',
  fetched_at timestamptz not null default now()
);
create index listing_snapshots_business_id_fetched_at_idx on public.listing_snapshots (business_id, fetched_at desc);

create table public.ai_traffic (
  business_id uuid not null references public.businesses (id) on delete cascade,
  date date not null,
  source text not null,
  sessions int not null default 0,
  primary key (business_id, date, source)
);

create function private.can_read_run(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.runs ru
    where ru.id = r and ru.kind <> 'free_audit' and private.is_business_member(ru.business_id)
  );
$$;

create function private.can_read_answer(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.answers an where an.id = a and private.can_read_run(an.run_id)
  );
$$;

revoke all on function private.can_read_run(uuid), private.can_read_answer(uuid) from public;
grant execute on function private.can_read_run(uuid), private.can_read_answer(uuid) to authenticated;

alter table public.runs enable row level security;
alter table public.answers enable row level security;
alter table public.citations enable row level security;
alter table public.listing_snapshots enable row level security;
alter table public.ai_traffic enable row level security;

create policy runs_read on public.runs for select to authenticated
  using (kind <> 'free_audit' and private.is_business_member(business_id));
create policy answers_read on public.answers for select to authenticated
  using (private.can_read_run(run_id));
create policy citations_read on public.citations for select to authenticated
  using (private.can_read_answer(answer_id));
create policy listing_snapshots_read on public.listing_snapshots for select to authenticated
  using (private.is_business_member(business_id));
create policy ai_traffic_read on public.ai_traffic for select to authenticated
  using (private.is_business_member(business_id));
