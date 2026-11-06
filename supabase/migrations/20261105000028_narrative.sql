-- G4 narrative: per-business want/avoid word lists. The match itself is computed on read from the
-- latest run's stored answer text (lead Q3; no LLM, nothing stored). Additive. Re-runnable.
-- Rollback: supabase/rollbacks/20261105000028_narrative.down.sql

-- A word list: ≤ 8 words, each lowercase, trimmed and 2-40 characters, no repeats.
create or replace function private.valid_narrative_words(w text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(w), 0) <= 8
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
    raise exception 'Up to 8 words each, 2 to 40 characters, none in both lists'
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

revoke all on function public.set_narrative_words(uuid, text[], text[]) from public, anon;
grant execute on function public.set_narrative_words(uuid, text[], text[]) to authenticated;
