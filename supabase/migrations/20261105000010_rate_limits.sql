-- Per-user rate limits for paid onboarding lookups (own-site reads, Maps SERP calls).
-- Rollback: supabase/rollbacks/20261105000010_rate_limits.down.sql

create table public.rate_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('read_site', 'maps')),
  created_at timestamptz not null default now()
);
create index rate_events_user_kind_created_at_idx on public.rate_events (user_id, kind, created_at);
-- RLS on with no policies: only take_rate_token and the service role touch it.
alter table public.rate_events enable row level security;

-- Limits are fixed here per kind so callers cannot raise them: read_site 10 per hour,
-- maps 5 per hour and 20 per 24 hours. Returns true and records one event when allowed.
-- The per-user, per-kind advisory lock serializes parallel calls. Events over 24 h old are pruned.
create function public.take_rate_token(p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  last_hour int;
  last_day int;
begin
  if uid is null then
    return false;
  end if;
  if p_kind is null or p_kind not in ('read_site', 'maps') then
    raise exception 'Unknown rate limit kind: %', p_kind using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('take_rate_token:' || uid::text || ':' || p_kind, 0));

  delete from public.rate_events
  where user_id = uid and kind = p_kind and created_at < now() - interval '24 hours';
  select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
  into last_hour, last_day
  from public.rate_events where user_id = uid and kind = p_kind;

  if (p_kind = 'read_site' and last_hour >= 10)
     or (p_kind = 'maps' and (last_hour >= 5 or last_day >= 20)) then
    return false;
  end if;
  insert into public.rate_events (user_id, kind) values (uid, p_kind);
  return true;
end;
$$;

-- 24 h cache of onboarding lookup results, so repeating a lookup (Back/Next) costs no token.
-- Service role only: users must not forge cached results. One row per user, kind and key.
-- result holds the normalized action result only, never a raw vendor response or error.
create table public.onboarding_lookups (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('read_site', 'maps')),
  key text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);
alter table public.onboarding_lookups enable row level security;
revoke all on table public.onboarding_lookups from anon, authenticated;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.take_rate_token(text) from public, anon;
grant execute on function public.take_rate_token(text) to authenticated;
