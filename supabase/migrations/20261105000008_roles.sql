-- Step 3: user roles and the self-serve workspace bootstrap used after sign-in.
-- Rollback: supabase/rollbacks/20261105000008_roles.down.sql

-- No row = self-serve. Rows are written by the service role only (seeded or flagged).
create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('team', 'dfy_client')),
  created_at timestamptz default now()
);
alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anon, authenticated;
grant select on table public.user_roles to authenticated;
create policy user_roles_select_own on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

-- Returns the caller's workspace, creating one (with the caller as owner) on the first
-- self-serve sign-in. Team and dfy_client users get null. The advisory lock makes
-- parallel first calls for one user wait for each other, so only one workspace is made.
create function public.ensure_self_serve_workspace() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ws uuid;
  local_part text;
begin
  if uid is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ensure_self_serve_workspace:' || uid::text, 0));

  if exists (select 1 from public.user_roles where user_id = uid) then
    return null;
  end if;

  select m.workspace_id into ws from public.workspace_members m
  where m.user_id = uid order by m.created_at, m.workspace_id limit 1;
  if ws is not null then
    return ws;
  end if;

  select nullif(split_part(u.email, '@', 1), '') into local_part from auth.users u where u.id = uid;
  insert into public.workspaces (name, owner_id)
  values (coalesce(local_part || '''s workspace', 'My workspace'), uid)
  returning id into ws;
  return ws;
end;
$$;

-- Where to send the caller after sign-in: 'team' | 'dfy_client' | 'onboarding' | 'dashboard'.
create function public.my_landing() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then null
    when r.role is not null then r.role
    when exists (
      select 1 from public.workspace_members m
      join public.businesses b on b.workspace_id = m.workspace_id and b.archived_at is null
      where m.user_id = auth.uid()
    ) then 'dashboard'
    else 'onboarding'
  end
  from (select (select role from public.user_roles where user_id = auth.uid()) as role) r;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.ensure_self_serve_workspace(), public.my_landing() from public, anon;
grant execute on function public.ensure_self_serve_workspace(), public.my_landing() to authenticated;
