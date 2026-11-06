-- G7: the one grouped R17 fix ("Get on these lists") built from a business's 'added' mention
-- decisions. Invoker, so the fixes RLS applies. Additive (live builds never call it). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000033_mention_fix.down.sql

-- Self-serve members or the team on DFY (can_write_business; never a dfy_client). With added
-- lists: update the open R17 fix (or insert it as todo) with evidence {urls}; with none: delete the
-- open (todo/doing) R17 and return null. A done R17 is left alone. 22023 bad detail or R17
-- disabled/missing (mention_rule_unavailable), 42501 refused.
create or replace function public.upsert_mention_fix(p_business_id uuid, p_detail text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  urls text[];
  rule record;
  fid uuid;
begin
  if not private.can_write_business(p_business_id) then
    raise exception 'Not allowed to change this business' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(btrim(p_detail), '') = '' or char_length(p_detail) > 2000 then
    raise exception 'The fix needs detail text of at most 2000 characters' using errcode = 'invalid_parameter_value';
  end if;
  urls := array(select d.url from public.mention_target_decisions d
                where d.business_id = p_business_id and d.status = 'added'
                order by d.decided_at desc, d.url);
  if cardinality(urls) = 0 then
    delete from public.fixes where business_id = p_business_id and rule_key = 'R17' and status <> 'done';
    return null;
  end if;
  select title, size into rule from public.fix_rules_public where key = 'R17' and enabled;
  if not found then
    raise exception 'mention_rule_unavailable' using errcode = 'invalid_parameter_value';
  end if;
  -- One statement on the open-fix unique index, so concurrent first calls can't raise 23505.
  insert into public.fixes (business_id, rule_key, size, title, detail, evidence, status)
  values (p_business_id, 'R17', rule.size, rule.title, btrim(p_detail), jsonb_build_object('urls', to_jsonb(urls)), 'todo')
  on conflict (business_id, rule_key) where status <> 'done' do update
    set detail = excluded.detail, evidence = excluded.evidence, title = excluded.title, size = excluded.size
  returning id into fid;
  return fid;
end;
$$;
revoke all on function public.upsert_mention_fix(uuid, text) from public, anon;
grant execute on function public.upsert_mention_fix(uuid, text) to authenticated;
