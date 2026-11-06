-- G2 "Can AI see your site?": one stored check per run (free audit or weekly), the Cloudflare fix
-- rule R16, and a service-only RPC to record a check. Additive; live v0.5.0 never touches these.
-- Rollback: supabase/rollbacks/20261105000025_ai_access.down.sql

create table if not exists public.ai_access_checks (
  run_id uuid primary key references public.runs (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  domain text not null,
  checked_at timestamptz not null default now(),
  outcome text not null check (outcome in ('good', 'blocked', 'js_empty', 'cloudflare', 'unreachable')),
  crawlers jsonb not null default '[]' check (jsonb_typeof(crawlers) = 'array'),
  visible_words int check (visible_words >= 0),
  status_normal int check (status_normal between 100 and 599),
  status_gptbot int check (status_gptbot between 100 and 599),
  cloudflare boolean not null default false,
  pages_checked int not null default 0 check (pages_checked >= 0)
);
create index if not exists ai_access_checks_business_id_idx on public.ai_access_checks (business_id, checked_at desc);

-- Read like the run: members of its business (incl. the dfy_client) and the team on DFY; a free
-- audit's check never (served by token through the service client). Nobody but the service writes.
alter table public.ai_access_checks enable row level security;
revoke all on table public.ai_access_checks from anon, authenticated;
grant select on table public.ai_access_checks to authenticated;
drop policy if exists ai_access_checks_read on public.ai_access_checks;
create policy ai_access_checks_read on public.ai_access_checks for select to authenticated
  using (private.can_read_run(run_id) or private.team_can_read_run(run_id));

-- Service role only. Stores (or replaces) a run's check. p = {domain, outcome, crawlers [{agent,
-- allowed, line}], visible_words, status_normal, status_gptbot, cloudflare, pages_checked}. 22023 bad input.
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
  if not private.is_hostname(lower(p ->> 'domain'))
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
  begin
    insert into public.ai_access_checks (run_id, business_id, domain, checked_at, outcome, crawlers, visible_words,
                                         status_normal, status_gptbot, cloudflare, pages_checked)
    values (p_run_id, biz, lower(p ->> 'domain'), now(), p ->> 'outcome', coalesce(p -> 'crawlers', '[]'),
            (p ->> 'visible_words')::int, (p ->> 'status_normal')::int, (p ->> 'status_gptbot')::int,
            coalesce((p ->> 'cloudflare')::boolean, false), coalesce((p ->> 'pages_checked')::int, 0))
    on conflict (run_id) do update
      set domain = excluded.domain, checked_at = excluded.checked_at, outcome = excluded.outcome,
          crawlers = excluded.crawlers, visible_words = excluded.visible_words,
          status_normal = excluded.status_normal, status_gptbot = excluded.status_gptbot,
          cloudflare = excluded.cloudflare, pages_checked = excluded.pages_checked;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Bad AI access check' using errcode = 'invalid_parameter_value';
  end;
end;
$$;
revoke all on function public.record_ai_access_check(uuid, jsonb) from public, anon, authenticated;

-- R16: Cloudflare's AI bot blocking (p5 via 0024's mapping). Copy is the lead's (GAS, 2026-11-06).
insert into public.fix_rules (key, grp, title, size, detection, data_source, cadence, threshold, unverified,
                              customer_copy, why_note, ai_lever, enabled)
values ('R16', 'restaurant', 'Your site lets AI in, but Cloudflare may be blocking it.', 'S',
        'cf-ray or server: cloudflare on the homepage response while robots.txt allows the AI crawlers.',
        'Our own fetch (headers only)', 'weekly', null, '{}'::text[],
        'Your site runs on Cloudflare. Its AI bot blocking is on by default for many new sites, and robots.txt can''t show it. Check Security, then Bots, in your Cloudflare dashboard.',
        'A hint, not proof: Cloudflare''s bot rules are not visible from outside. No effect claim.', true, true)
on conflict (key) do nothing;
