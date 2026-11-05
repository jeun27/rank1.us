-- Reference data: domain_categories, fix_rules (+ fix_rules_public), question_templates, local_places.
-- Rollback: supabase/rollbacks/20261105000002_reference.down.sql

-- Founder writes go through a server route that checks FOUNDER_EMAIL and uses the
-- service role, so there is no write policy here.
create table public.domain_categories (
  domain text primary key,
  category text not null check (category in ('reddit', 'youtube', 'social', 'review_directory', 'news_blog', 'other')),
  source text not null check (source in ('rule', 'manual'))
);

create table public.fix_rules (
  key text primary key check (key ~ '^(A[1-6]|R([1-9]|1[0-5])|H1)$'),
  grp text not null check (grp in ('answers', 'restaurant', 'hygiene')),
  title text not null,
  size text not null check (size in ('S', 'S-M', 'M', 'M-L', 'L')),
  detection text,
  data_source text,
  cadence text not null check (cadence in ('weekly', 'monthly')),
  threshold jsonb,
  unverified text[] not null default '{}',
  customer_copy text not null,
  why_note text,
  ai_lever boolean not null default true,
  enabled boolean not null default false,
  check (key <> 'H1' or ai_lever = false)
);

-- Runs as the view owner, so the app reads fix_rules without seeing why_note.
create view public.fix_rules_public with (security_invoker = false) as
  select key, grp, title, size, detection, data_source, cadence, threshold,
         unverified, customer_copy, ai_lever, enabled
  from public.fix_rules;

create table public.question_templates (
  id uuid primary key default gen_random_uuid(),
  vertical text not null default 'restaurant' check (vertical in ('restaurant')),
  short_form text not null,
  long_form text not null,
  slots text[] not null default '{}',
  fixed_cuisine text,
  fixed_city text,
  origin text,
  sort int not null default 0
);

create table public.local_places (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  name text not null,
  kind text not null check (kind in ('landmark', 'area')),
  verified boolean not null default false
);
create index local_places_city_state_idx on public.local_places (city, state);

alter table public.domain_categories enable row level security;
alter table public.fix_rules enable row level security;
alter table public.question_templates enable row level security;
alter table public.local_places enable row level security;

revoke all on table public.fix_rules_public from anon, authenticated;
grant select on table public.fix_rules_public to authenticated;

create policy domain_categories_read on public.domain_categories for select to authenticated using (true);
create policy question_templates_read on public.question_templates for select to authenticated using (true);
create policy local_places_read on public.local_places for select to authenticated using (true);
-- fix_rules: no policies (service role only).
