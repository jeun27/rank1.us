-- Reverts 20261105000032_ai_access_pending.sql.
drop function if exists public.runs_needing_ai_access_check(int);

-- record_ai_access_check goes back to its 0025 version, and the error column is dropped.
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
alter table public.ai_access_checks drop column if exists error;
delete from public.ai_access_checks where domain is null or not private.is_hostname(domain);
alter table public.ai_access_checks alter column domain set not null;
