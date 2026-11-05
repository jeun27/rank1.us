-- Service-role-only tables: RLS on, no policies for anon or authenticated.
-- Rollback: supabase/rollbacks/20261105000005_service_only.down.sql

create table public.google_tokens (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  refresh_token_enc text not null,
  scope text,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  domain text,
  run_id uuid references public.runs (id) on delete set null,
  token text not null unique,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index leads_run_id_idx on public.leads (run_id);

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  tier text,
  message text,
  ip_hash text,
  user_agent text,
  emailed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.stripe_events (
  event_id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.google_tokens enable row level security;
alter table public.leads enable row level security;
alter table public.contact_requests enable row level security;
alter table public.stripe_events enable row level security;
