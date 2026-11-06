-- G2: free audits still needing an AI access check, for data-pipeline's run-jobs hook. Paid runs
-- ride the existing fix pass. Additive (live builds never call it). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000032_ai_access_pending.down.sql

-- Service role only. Complete/partial free_audit runs started in the last 7 days (old audits never
-- backfill) with no ai_access_checks row, oldest first. The domain is the free audit's snapshot domain.
create or replace function public.runs_needing_ai_access_check(p_limit int)
returns table (run_id uuid, domain text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role only' using errcode = 'insufficient_privilege';
  end if;
  return query
  select r.id, fa.domain
  from public.runs r
  join public.free_audits fa on fa.run_id = r.id
  where r.kind = 'free_audit' and r.status in ('complete', 'partial')
    and r.started_at >= now() - interval '7 days'
    and not exists (select 1 from public.ai_access_checks c where c.run_id = r.id)
  order by r.started_at, r.id
  limit least(greatest(coalesce(p_limit, 0), 0), 100);
end;
$$;
revoke all on function public.runs_needing_ai_access_check(int) from public, anon, authenticated;

-- Reviewer S1: a failed check still records a row (outcome unreachable) so it leaves the list above,
-- with a short error code (timeout, blocked_address, a PG code...; never message text).
alter table public.ai_access_checks add column if not exists error text check (error ~ '^[A-Za-z0-9_]{1,40}$');

-- Reviewer S1: an unreachable check is stored even when the domain isn't a valid hostname (or is
-- missing), as given and capped at 253 characters, so a bad-domain free audit still leaves the list.
alter table public.ai_access_checks alter column domain drop not null;

-- Redefined from 0025: also stores p.error (optional, a short code; 22023 otherwise), and accepts any
-- domain on an unreachable check.
create or replace function public.record_ai_access_check(p_run_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  biz uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role only' using errcode = 'insufficient_privilege';
  end if;
  select business_id into biz from public.runs where id = p_run_id;
  if not found then
    raise exception 'Unknown run' using errcode = 'invalid_parameter_value';
  end if;
  if (coalesce(p ->> 'outcome', '') <> 'unreachable' and not private.is_hostname(lower(p ->> 'domain')))
     or coalesce(p ->> 'outcome', '') not in ('good', 'blocked', 'js_empty', 'cloudflare', 'unreachable')
     or jsonb_typeof(coalesce(p -> 'crawlers', '[]')) <> 'array'
     or exists (
       select 1 from jsonb_array_elements(coalesce(p -> 'crawlers', '[]')) c
       where jsonb_typeof(c) <> 'object'
          or coalesce(c ->> 'agent', '') not in ('GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot',
                                                 'PerplexityBot', 'Google-Extended')
          or jsonb_typeof(c -> 'allowed') <> 'boolean'
          or char_length(c ->> 'line') > 500) then
    raise exception 'Bad AI access check' using errcode = 'invalid_parameter_value';
  end if;
  if p ? 'error' and jsonb_typeof(p -> 'error') <> 'null' and (p ->> 'error') !~ '^[A-Za-z0-9_]{1,40}$' then
    raise exception 'error must be a short code' using errcode = 'invalid_parameter_value';
  end if;
  begin
    insert into public.ai_access_checks (run_id, business_id, domain, checked_at, outcome, crawlers, visible_words,
                                         status_normal, status_gptbot, cloudflare, pages_checked, error)
    values (p_run_id, biz, case when private.is_hostname(lower(p ->> 'domain')) then lower(p ->> 'domain')
                                else left(p ->> 'domain', 253) end, now(), p ->> 'outcome', coalesce(p -> 'crawlers', '[]'),
            (p ->> 'visible_words')::int, (p ->> 'status_normal')::int, (p ->> 'status_gptbot')::int,
            coalesce((p ->> 'cloudflare')::boolean, false), coalesce((p ->> 'pages_checked')::int, 0),
            p ->> 'error')
    on conflict (run_id) do update
      set domain = excluded.domain, checked_at = excluded.checked_at, outcome = excluded.outcome,
          crawlers = excluded.crawlers, visible_words = excluded.visible_words,
          status_normal = excluded.status_normal, status_gptbot = excluded.status_gptbot,
          cloudflare = excluded.cloudflare, pages_checked = excluded.pages_checked, error = excluded.error;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Bad AI access check' using errcode = 'invalid_parameter_value';
  end;
end;
$$;

