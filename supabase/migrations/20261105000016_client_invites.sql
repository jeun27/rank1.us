-- Step 12: client invites and fix list visibility. No invites table: Supabase Auth sends the
-- invite, then the service role grants the dfy_client role + workspace membership.
-- Additive and re-runnable. Rollback: supabase/rollbacks/20261105000016_client_invites.down.sql

-- Service role only. Whether an email can be invited as a client of this DFY business:
-- 'new' (no account), 'already_client' (this business's client) or 'existing_account'
-- (any other account, incl. another business's client: one business per client user in v1).
create or replace function public.client_invite_status(p_email text, p_business_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  ws uuid;
  uid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can check invites' using errcode = 'insufficient_privilege';
  end if;
  select b.workspace_id into ws from public.businesses b where b.id = p_business_id and b.service = 'dfy';
  if ws is null then
    raise exception 'Not a DFY business' using errcode = 'invalid_parameter_value';
  end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
  if uid is null then
    return 'new';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = uid and r.role = 'dfy_client')
     and exists (select 1 from public.workspace_members m where m.user_id = uid and m.workspace_id = ws) then
    return 'already_client';
  end if;
  return 'existing_account';
end;
$$;

-- Service role only. Makes a (new) user the client of a DFY business: the dfy_client role plus
-- 'member' of the business's workspace. Idempotent. Refuses team users and users who belong to
-- any other workspace, so an existing account never loses its own access.
create or replace function public.grant_dfy_client(p_user_id uuid, p_business_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can grant client access' using errcode = 'insufficient_privilege';
  end if;
  select b.workspace_id into ws from public.businesses b where b.id = p_business_id and b.service = 'dfy' for update;
  if ws is null then
    raise exception 'Not a DFY business' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Unknown user' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role <> 'dfy_client')
     or exists (select 1 from public.workspace_members m where m.user_id = p_user_id and m.workspace_id <> ws) then
    raise exception 'This user already has other Rank1 access' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role = 'dfy_client')
     and exists (select 1 from public.workspace_members m where m.user_id = p_user_id and m.workspace_id = ws) then
    return 'already';
  end if;
  insert into public.user_roles (user_id, role) values (p_user_id, 'dfy_client') on conflict (user_id) do nothing;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, p_user_id, 'member')
  on conflict (workspace_id, user_id) do nothing;
  return 'granted';
end;
$$;

-- Service role only. Removes a client user's membership of the business's workspace (never an
-- owner). The role row stays, so they keep landing on /client with the empty state.
create or replace function public.revoke_dfy_client(p_user_id uuid, p_business_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  removed int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can remove client access' using errcode = 'insufficient_privilege';
  end if;
  delete from public.workspace_members m
  using public.businesses b
  where b.id = p_business_id and b.service = 'dfy' and m.workspace_id = b.workspace_id
    and m.user_id = p_user_id and m.role = 'member'
    and exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role = 'dfy_client');
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- Team only: show or hide a DFY business's fix list to its client users.
create or replace function public.set_fix_list_visible(p_business_id uuid, p_visible boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_visible is null or not private.is_team_dfy_business(p_business_id) then
    raise exception 'Only the Rank1 team can change this' using errcode = 'insufficient_privilege';
  end if;
  update public.businesses set fix_list_visible = p_visible where id = p_business_id;
end;
$$;

-- Team only: a DFY business's client users with their emails (never exposed to clients).
create or replace function public.list_client_users(p_business_id uuid)
returns table (user_id uuid, email text, added_at timestamptz, signed_in boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_team_dfy_business(p_business_id) then
    raise exception 'Only the Rank1 team can list clients' using errcode = 'insufficient_privilege';
  end if;
  return query
  select m.user_id, u.email::text, m.created_at, u.last_sign_in_at is not null
  from public.businesses b
  join public.workspace_members m on m.workspace_id = b.workspace_id
  join public.user_roles r on r.user_id = m.user_id and r.role = 'dfy_client'
  join auth.users u on u.id = m.user_id
  where b.id = p_business_id
  order by m.created_at, m.user_id;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.client_invite_status(text, uuid), public.grant_dfy_client(uuid, uuid),
  public.revoke_dfy_client(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_fix_list_visible(uuid, boolean), public.list_client_users(uuid) from public, anon;
grant execute on function public.set_fix_list_visible(uuid, boolean), public.list_client_users(uuid) to authenticated;
