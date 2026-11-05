-- Per-user rate limits for paid onboarding lookups (own-site reads, Maps SERP calls).
-- Rollback: supabase/rollbacks/20261105000010_rate_limits.down.sql

create table public.rate_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('read_site', 'maps_lookup')),
  created_at timestamptz not null default now()
);
create index rate_events_user_kind_created_at_idx on public.rate_events (user_id, kind, created_at);
-- RLS on with no policies: only take_rate_token and the service role touch it.
alter table public.rate_events enable row level security;

-- True (and one event recorded) when the caller had fewer than p_max events of p_kind in
-- p_window; false otherwise or without a user. The advisory lock serializes one user's kind.
create function public.take_rate_token(p_kind text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('take_rate_token:' || uid::text || ':' || p_kind, 0));
  if (select count(*) from public.rate_events
      where user_id = uid and kind = p_kind and created_at > now() - p_window) >= p_max then
    return false;
  end if;
  insert into public.rate_events (user_id, kind) values (uid, p_kind);
  return true;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.take_rate_token(text, int, interval) from public, anon;
grant execute on function public.take_rate_token(text, int, interval) to authenticated;
