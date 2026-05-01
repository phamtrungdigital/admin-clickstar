-- 0018_role_permissions.sql
-- Editable per-role action permissions. RLS already gates DATA access by
-- company / project; this table layers on a UI/business gate for ACTIONS
-- (e.g. "can a manager create a contract?").
--
-- Source of truth at runtime is this table — the UI matrix at
-- /admin/roles reads + writes it. PRD §3 supplies the seed defaults.
--
-- We store one row per (role, scope) so the matrix is just rows in/out.
-- "scope" is a logical surface (users, customers, contracts, ...) and
-- "level" is one of: none, view, scoped, manage, full.

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'permission_level' and typnamespace = 'public'::regnamespace
  ) then
    create type public.permission_level as enum (
      'none',
      'view',
      'scoped',
      'manage',
      'full'
    );
  end if;
end $$;

create table if not exists public.role_permissions (
  role         public.internal_role not null,
  scope        text not null,
  level        public.permission_level not null default 'none',
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null,
  primary key (role, scope)
);

drop trigger if exists set_role_permissions_updated_at on public.role_permissions;
create trigger set_role_permissions_updated_at
  before update on public.role_permissions
  for each row execute function public.set_updated_at();

-- RLS: anyone authenticated reads (UI needs to know what current user can do);
-- only super_admin writes. Admin users CAN see but cannot edit — keeps the
-- "you can't elevate yourself" guarantee.
alter table public.role_permissions enable row level security;

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (true);

drop policy if exists role_permissions_modify_super_admin on public.role_permissions;
create policy role_permissions_modify_super_admin on public.role_permissions
  for all to authenticated
  using (public.current_internal_role() = 'super_admin')
  with check (public.current_internal_role() = 'super_admin');

-- Seed defaults — mirrors the matrix shipped in commit 3c06804 / PRD §3.
insert into public.role_permissions (role, scope, level) values
  -- super_admin
  ('super_admin', 'users',     'full'),
  ('super_admin', 'customers', 'full'),
  ('super_admin', 'contracts', 'full'),
  ('super_admin', 'services',  'full'),
  ('super_admin', 'tasks',     'full'),
  ('super_admin', 'tickets',   'full'),
  ('super_admin', 'documents', 'full'),
  ('super_admin', 'reports',   'full'),
  ('super_admin', 'settings',  'full'),
  -- admin
  ('admin', 'users',     'manage'),
  ('admin', 'customers', 'manage'),
  ('admin', 'contracts', 'manage'),
  ('admin', 'services',  'manage'),
  ('admin', 'tasks',     'manage'),
  ('admin', 'tickets',   'manage'),
  ('admin', 'documents', 'manage'),
  ('admin', 'reports',   'view'),
  ('admin', 'settings',  'manage'),
  -- manager
  ('manager', 'users',     'view'),
  ('manager', 'customers', 'scoped'),
  ('manager', 'contracts', 'scoped'),
  ('manager', 'services',  'view'),
  ('manager', 'tasks',     'scoped'),
  ('manager', 'tickets',   'scoped'),
  ('manager', 'documents', 'scoped'),
  ('manager', 'reports',   'view'),
  ('manager', 'settings',  'none'),
  -- staff (Nhân viên triển khai)
  ('staff', 'users',     'none'),
  ('staff', 'customers', 'scoped'),
  ('staff', 'contracts', 'scoped'),
  ('staff', 'services',  'view'),
  ('staff', 'tasks',     'scoped'),
  ('staff', 'tickets',   'scoped'),
  ('staff', 'documents', 'scoped'),
  ('staff', 'reports',   'none'),
  ('staff', 'settings',  'none'),
  -- support (CSKH)
  ('support', 'users',     'none'),
  ('support', 'customers', 'scoped'),
  ('support', 'contracts', 'view'),
  ('support', 'services',  'view'),
  ('support', 'tasks',     'view'),
  ('support', 'tickets',   'scoped'),
  ('support', 'documents', 'scoped'),
  ('support', 'reports',   'none'),
  ('support', 'settings',  'none'),
  -- accountant (Kế toán)
  ('accountant', 'users',     'none'),
  ('accountant', 'customers', 'view'),
  ('accountant', 'contracts', 'manage'),
  ('accountant', 'services',  'view'),
  ('accountant', 'tasks',     'none'),
  ('accountant', 'tickets',   'none'),
  ('accountant', 'documents', 'scoped'),
  ('accountant', 'reports',   'view'),
  ('accountant', 'settings',  'none')
on conflict (role, scope) do nothing;
