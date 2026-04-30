-- 0003_profiles.sql
-- profiles: 1:1 with auth.users, holds business identity (audience, internal_role, full_name, ...)
-- The auth trigger auto-creates a profile row when a new auth.users row is inserted.

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  avatar_url    text,
  audience      public.audience not null default 'customer',
  internal_role public.internal_role,            -- only set when audience = 'internal'
  phone         text,
  is_active     boolean not null default true,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint profiles_internal_role_only_internal
    check (
      (audience = 'internal' and internal_role is not null)
      or (audience = 'customer' and internal_role is null)
    )
);

create index if not exists profiles_audience_idx on public.profiles (audience) where deleted_at is null;
create index if not exists profiles_internal_role_idx on public.profiles (internal_role) where deleted_at is null;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auth trigger: on auth.users insert, create matching profile.
-- Reads user_metadata for audience/internal_role/full_name when admin creates the user
-- via supabase.auth.admin.createUser({ user_metadata: { audience, internal_role, full_name } }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audience public.audience;
  v_role     public.internal_role;
  v_name     text;
begin
  v_audience := coalesce(
    nullif(new.raw_user_meta_data->>'audience', ''),
    'customer'
  )::public.audience;

  v_role := nullif(new.raw_user_meta_data->>'internal_role', '')::public.internal_role;

  if v_audience = 'internal' and v_role is null then
    -- Default new internal users to 'staff' if no role specified
    v_role := 'staff';
  elsif v_audience = 'customer' then
    v_role := null;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', '');

  insert into public.profiles (id, audience, internal_role, full_name)
  values (new.id, v_audience, v_role, v_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
