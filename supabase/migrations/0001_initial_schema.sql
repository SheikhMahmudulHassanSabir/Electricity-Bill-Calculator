-- =============================================================================
-- Electricity Bill Calculator — Initial Schema, Functions, Views & RLS Policies
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- Profiles table linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

-- Workspaces table (shared household / flat / building)
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  rate_per_unit numeric(12, 4) check (rate_per_unit is null or rate_per_unit >= 0),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Workspace members join table
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Meters table (soft-deleted via is_active so bill history stays intact)
create table if not exists public.meters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  initial_reading numeric(14, 4) not null default 0 check (initial_reading >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Saved bills header table
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bill_date date not null default current_date,
  rate_per_unit numeric(12, 4) not null check (rate_per_unit >= 0),
  total_units numeric(14, 6) not null check (total_units >= 0),
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Saved bill line items (stores meter_name snapshot so history remains intact)
create table if not exists public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  meter_id uuid references public.meters(id) on delete set null,
  meter_name text not null,
  previous_reading numeric(14, 4) not null check (previous_reading >= 0),
  current_reading numeric(14, 4) not null check (current_reading >= previous_reading),
  units numeric(14, 6) not null check (units >= 0),
  amount numeric(14, 2) not null check (amount >= 0)
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_meters_workspace on public.meters(workspace_id, is_active, sort_order);
create index if not exists idx_bills_workspace_date on public.bills(workspace_id, bill_date desc, created_at desc);
create index if not exists idx_bill_items_bill on public.bill_items(bill_id);
create index if not exists idx_bill_items_meter on public.bill_items(meter_id);

-- -----------------------------------------------------------------------------
-- 2. Trigger: Auto-create profile row when a user signs up in auth.users
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'User')
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. Trigger: Auto-add creator as workspace owner on workspace insert
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- -----------------------------------------------------------------------------
-- 4. Helper Functions for RLS & Collaboration
-- -----------------------------------------------------------------------------
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

-- Function to join a workspace using an invite code
create or replace function public.join_workspace(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required to join a workspace.';
  end if;

  select w.id into v_workspace_id
  from public.workspaces w
  where upper(trim(w.invite_code)) = upper(trim(p_invite_code))
  limit 1;

  if v_workspace_id is null then
    raise exception 'Invalid invite code. Please check the code and try again.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_uid, 'member')
  on conflict (workspace_id, user_id) do nothing;

  return v_workspace_id;
end;
$$;

-- Function for owner to regenerate invite code
create or replace function public.regenerate_invite_code(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_code text;
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can regenerate the invite code.';
  end if;

  v_new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  update public.workspaces
  set invite_code = v_new_code
  where id = p_workspace_id;

  return v_new_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. View: Latest current reading per meter (used by auto-fill)
-- -----------------------------------------------------------------------------
create or replace view public.meter_latest_readings
with (security_invoker = true)
as
select distinct on (bi.meter_id)
  bi.meter_id,
  b.workspace_id,
  bi.current_reading as latest_reading,
  b.bill_date as latest_bill_date,
  b.id as latest_bill_id
from public.bill_items bi
inner join public.bills b on b.id = bi.bill_id
where bi.meter_id is not null
order by bi.meter_id, b.bill_date desc, b.created_at desc;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.meters enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;

-- Profiles policies: users can view profiles of people in their workspaces or themselves
create policy "profiles_select"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm1
      join public.workspace_members wm2 on wm1.workspace_id = wm2.workspace_id
      where wm1.user_id = auth.uid()
        and wm2.user_id = public.profiles.id
    )
  );

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Workspaces policies
create policy "workspaces_select_member"
  on public.workspaces for select
  using (public.is_workspace_member(id) or created_by = auth.uid());

create policy "workspaces_insert_authenticated"
  on public.workspaces for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "workspaces_update_member"
  on public.workspaces for update
  using (public.is_workspace_member(id))
  with check (public.is_workspace_member(id));

create policy "workspaces_delete_owner"
  on public.workspaces for delete
  using (public.is_workspace_owner(id));

-- Workspace members policies
create policy "workspace_members_select"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert_owner"
  on public.workspace_members for insert
  with check (
    (user_id = auth.uid() and role = 'owner')
    or public.is_workspace_owner(workspace_id)
  );

create policy "workspace_members_delete_owner_or_self"
  on public.workspace_members for delete
  using (
    public.is_workspace_owner(workspace_id)
    or user_id = auth.uid()
  );

-- Meters policies (both owner and member can add, edit, soft-delete)
create policy "meters_select_member"
  on public.meters for select
  using (public.is_workspace_member(workspace_id));

create policy "meters_insert_member"
  on public.meters for insert
  with check (public.is_workspace_member(workspace_id));

create policy "meters_update_member"
  on public.meters for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "meters_delete_member"
  on public.meters for delete
  using (public.is_workspace_member(workspace_id));

-- Bills policies (both owner and member can view, create, delete)
create policy "bills_select_member"
  on public.bills for select
  using (public.is_workspace_member(workspace_id));

create policy "bills_insert_member"
  on public.bills for insert
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "bills_delete_member"
  on public.bills for delete
  using (public.is_workspace_member(workspace_id));

-- Bill items policies
create policy "bill_items_select_member"
  on public.bill_items for select
  using (
    exists (
      select 1 from public.bills b
      where b.id = public.bill_items.bill_id
        and public.is_workspace_member(b.workspace_id)
    )
  );

create policy "bill_items_insert_member"
  on public.bill_items for insert
  with check (
    exists (
      select 1 from public.bills b
      where b.id = public.bill_items.bill_id
        and public.is_workspace_member(b.workspace_id)
    )
  );

create policy "bill_items_delete_member"
  on public.bill_items for delete
  using (
    exists (
      select 1 from public.bills b
      where b.id = public.bill_items.bill_id
        and public.is_workspace_member(b.workspace_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Realtime publication setup
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.workspaces;
    alter publication supabase_realtime add table public.workspace_members;
    alter publication supabase_realtime add table public.meters;
    alter publication supabase_realtime add table public.bills;
    alter publication supabase_realtime add table public.bill_items;
  end if;
exception
  when duplicate_object then null;
end;
$$;
