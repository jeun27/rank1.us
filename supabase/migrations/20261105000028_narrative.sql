-- G4 narrative: per-business want/avoid word lists and one stored word-match result per run
-- (no LLM: data-pipeline matches words in stored answer text). Additive. Re-runnable.
-- Rollback: supabase/rollbacks/20261105000028_narrative.down.sql

-- A word list: ≤ 20 words, each lowercase, trimmed and 2-40 characters, no repeats.
create or replace function private.valid_narrative_words(w text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(w), 0) <= 20
    and not exists (select 1 from unnest(w) e
                    where e is null or e <> lower(btrim(e)) or char_length(e) not between 2 and 40)
    and (select count(distinct e) from unnest(w) e) = coalesce(cardinality(w), 0);
$$;
revoke all on function private.valid_narrative_words(text[]) from public;
grant execute on function private.valid_narrative_words(text[]) to authenticated, service_role;

-- Not in the 0007 column grants: set only through set_narrative_words.
alter table public.businesses
  add column if not exists narrative_want text[] not null default '{}',
  add column if not exists narrative_avoid text[] not null default '{}';
alter table public.businesses drop constraint if exists businesses_narrative_words_check;
alter table public.businesses add constraint businesses_narrative_words_check
  check (private.valid_narrative_words(narrative_want) and private.valid_narrative_words(narrative_avoid)
         and not (narrative_want && narrative_avoid));

-- Self-serve members or the team on DFY (never a dfy_client), like set_report_settings.
-- Words are trimmed, lowercased and deduped in order. 22023 bad lists, 42501 not allowed.
create or replace function public.set_narrative_words(p_business_id uuid, p_want text[], p_avoid text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w text[];
  a text[];
begin
  if not private.can_write_business(p_business_id) then
    raise exception 'Not allowed to change this business' using errcode = 'insufficient_privilege';
  end if;
  w := private.clean_words(p_want);
  a := private.clean_words(p_avoid);
  if not private.valid_narrative_words(w) or not private.valid_narrative_words(a) or w && a then
    raise exception 'Up to 20 words each, 2 to 40 characters, none in both lists'
      using errcode = 'invalid_parameter_value';
  end if;
  update public.businesses set narrative_want = w, narrative_avoid = a where id = p_business_id;
end;
$$;

create or replace function private.clean_words(w text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array(
    select e from (
      select lower(btrim(x)) as e, min(o) as first_at
      from unnest(w) with ordinality as t(x, o)
      where btrim(coalesce(x, '')) <> ''
      group by lower(btrim(x))
    ) d order by first_at), '{}');
$$;
revoke all on function private.clean_words(text[]) from public;

create table if not exists public.narrative_results (
  run_id uuid primary key references public.runs (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  checked_at timestamptz not null default now(),
  want jsonb not null default '[]' check (jsonb_typeof(want) = 'array'),
  avoid jsonb not null default '[]' check (jsonb_typeof(avoid) = 'array'),
  n int not null default 0 check (n >= 0),
  snippet text check (char_length(snippet) <= 400),
  snippet_word text
);
create index if not exists narrative_results_business_id_idx on public.narrative_results (business_id, checked_at desc);

-- Read like the run (members incl. the dfy_client, the team on DFY; a free audit's: service only).
alter table public.narrative_results enable row level security;
revoke all on table public.narrative_results from anon, authenticated;
grant select on table public.narrative_results to authenticated;
drop policy if exists narrative_results_read on public.narrative_results;
create policy narrative_results_read on public.narrative_results for select to authenticated
  using (private.can_read_run(run_id) or private.team_can_read_run(run_id));

-- Service role only. Stores (or replaces) a run's match. p = {want: [{word, count}], avoid, n,
-- snippet, snippet_word}. Words must be the business's; counts ≤ n; the snippet (≤ 400 chars)
-- must be text of one of the run's stored answers and contain snippet_word. 22023 otherwise.
create or replace function public.record_narrative_result(p_run_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  biz uuid;
  words text[];
  v_n int;
  v_snip text := p ->> 'snippet';
  v_word text := lower(p ->> 'snippet_word');
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role only' using errcode = 'insufficient_privilege';
  end if;
  select r.business_id, b.narrative_want || b.narrative_avoid into biz, words
  from public.runs r left join public.businesses b on b.id = r.business_id where r.id = p_run_id;
  if not found or biz is null then
    raise exception 'Unknown run or no business' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(p -> 'n') <> 'number' or (p ->> 'n') !~ '^[0-9]{1,9}$' then
    raise exception 'n must be a whole number' using errcode = 'invalid_parameter_value';
  end if;
  v_n := (p ->> 'n')::int;
  if jsonb_typeof(coalesce(p -> 'want', '[]')) <> 'array' or jsonb_typeof(coalesce(p -> 'avoid', '[]')) <> 'array'
     or exists (
       select 1 from jsonb_array_elements(coalesce(p -> 'want', '[]') || coalesce(p -> 'avoid', '[]')) e
       where jsonb_typeof(e) <> 'object' or not ((e ->> 'word') = any (words))
          or jsonb_typeof(e -> 'count') <> 'number' or (e ->> 'count') !~ '^[0-9]{1,9}$'
          or (e ->> 'count')::int > v_n) then
    raise exception 'Matches must be the business''s words with counts up to n' using errcode = 'invalid_parameter_value';
  end if;
  if v_snip is not null and (
       char_length(v_snip) > 400 or v_word is null or not (v_word = any (words))
       or position(v_word in lower(v_snip)) = 0
       or not exists (select 1 from public.answers a where a.run_id = p_run_id and position(v_snip in a.text) > 0)) then
    raise exception 'The snippet must be stored answer text (at most 400 characters) with its word'
      using errcode = 'invalid_parameter_value';
  end if;
  insert into public.narrative_results (run_id, business_id, checked_at, want, avoid, n, snippet, snippet_word)
  values (p_run_id, biz, now(), coalesce(p -> 'want', '[]'), coalesce(p -> 'avoid', '[]'), v_n, v_snip,
          case when v_snip is null then null else v_word end)
  on conflict (run_id) do update
    set checked_at = excluded.checked_at, want = excluded.want, avoid = excluded.avoid, n = excluded.n,
        snippet = excluded.snippet, snippet_word = excluded.snippet_word;
end;
$$;

revoke all on function public.record_narrative_result(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.set_narrative_words(uuid, text[], text[]) from public, anon;
grant execute on function public.set_narrative_words(uuid, text[], text[]) to authenticated;
