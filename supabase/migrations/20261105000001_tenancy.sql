-- Tenancy: workspaces, members, businesses, competitors, questions + membership helpers.
-- Rollback: supabase/rollbacks/20261105000001_tenancy.down.sql

-- Helpers live in a schema PostgREST does not expose.
create schema private;
grant usage on schema private to authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  seats_quantity int not null default 0 check (seats_quantity >= 0),
  created_at timestamptz not null default now()
);
create index workspaces_owner_id_idx on public.workspaces (owner_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create function private.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create function private.is_owner(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- The creator of a workspace becomes its owner member.
create function private.add_owner_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger workspaces_add_owner_member
  after insert on public.workspaces
  for each row execute function private.add_owner_member();

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  domain text,
  aliases text[] not null default '{}',
  vertical text not null default 'restaurant',
  cuisine text,
  city text not null default 'Irvine',
  state text not null default 'CA',
  country text not null default 'US',
  brand_color text,
  logo_path text,
  report_recipients text[] not null default '{}',
  ga4_property_id text,
  archived_at timestamptz
);
create index businesses_workspace_id_idx on public.businesses (workspace_id);

create function private.is_business_member(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    join public.workspace_members m on m.workspace_id = bz.workspace_id
    where bz.id = b and m.user_id = (select auth.uid())
  );
$$;

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  domain text,
  aliases text[] not null default '{}',
  source text not null check (source in ('maps', 'manual', 'suggested')),
  maps_cid text,
  rating numeric(2, 1) check (rating between 0 and 5),
  hidden boolean not null default false
);
create index competitors_business_id_idx on public.competitors (business_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  short_text text not null,
  long_text text,
  active_form text not null default 'short' check (active_form in ('short', 'long')),
  active boolean not null default true,
  location_level text not null check (location_level in ('country', 'state', 'city')),
  country text,
  state text,
  city text,
  dfs_location_code int,
  template_key text
);
create index questions_business_id_idx on public.questions (business_id);

revoke all on function private.is_member(uuid), private.is_owner(uuid), private.is_business_member(uuid) from public;
grant execute on function private.is_member(uuid), private.is_owner(uuid), private.is_business_member(uuid) to authenticated;
revoke all on function private.add_owner_member() from public;

-- RLS
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.businesses enable row level security;
alter table public.competitors enable row level security;
alter table public.questions enable row level security;

-- Billing fields (stripe_*, subscription_status, seats_quantity) are service-role only:
-- signed-in users may insert (name, owner_id) and update name, nothing else.
revoke all on table public.workspaces from anon, authenticated;
grant select on table public.workspaces to authenticated;
grant insert (name, owner_id) on table public.workspaces to authenticated;
grant update (name) on table public.workspaces to authenticated;

-- owner_id check lets INSERT ... RETURNING see the row before the member row is visible.
create policy workspaces_select on public.workspaces for select to authenticated
  using (private.is_member(id) or owner_id = (select auth.uid()));
create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy workspaces_update on public.workspaces for update to authenticated
  using (private.is_owner(id)) with check (private.is_owner(id));

create policy workspace_members_select on public.workspace_members for select to authenticated
  using (private.is_member(workspace_id));
create policy workspace_members_insert on public.workspace_members for insert to authenticated
  with check (private.is_owner(workspace_id));
create policy workspace_members_update on public.workspace_members for update to authenticated
  using (private.is_owner(workspace_id)) with check (private.is_owner(workspace_id));
create policy workspace_members_delete on public.workspace_members for delete to authenticated
  using (private.is_owner(workspace_id));

create policy businesses_member on public.businesses for all to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy competitors_member on public.competitors for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy questions_member on public.questions for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
