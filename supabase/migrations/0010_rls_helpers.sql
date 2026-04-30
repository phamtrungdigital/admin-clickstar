-- 0010_rls_helpers.sql
-- Security helper functions used by RLS policies in 0011.
-- All marked SECURITY DEFINER + SET search_path so callers cannot inject.
-- Marked STABLE so Postgres can cache results within a single statement.

-- Current user's profile id (= auth.uid()) ---------------------------------
create or replace function public.auth_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid();
$$;

-- Current user's audience ('internal' | 'customer' | null) -----------------
create or replace function public.current_audience()
returns public.audience
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select audience from public.profiles where id = auth.uid() and deleted_at is null;
$$;

-- Current user's internal_role ---------------------------------------------
create or replace function public.current_internal_role()
returns public.internal_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select internal_role from public.profiles where id = auth.uid() and deleted_at is null;
$$;

-- True if current user is internal (any internal_role) ---------------------
create or replace function public.is_internal()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select audience = 'internal' from public.profiles where id = auth.uid() and deleted_at is null and is_active),
    false
  );
$$;

-- True if current user is super_admin or admin ----------------------------
create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select audience = 'internal' and internal_role in ('super_admin', 'admin')
      from public.profiles where id = auth.uid() and deleted_at is null and is_active
    ),
    false
  );
$$;

-- True if current user is super_admin only ---------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select audience = 'internal' and internal_role = 'super_admin'
      from public.profiles where id = auth.uid() and deleted_at is null and is_active
    ),
    false
  );
$$;

-- Customer companies the current user can see (only customer users) -------
create or replace function public.current_customer_companies()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(company_id), '{}'::uuid[])
  from public.company_members
  where user_id = auth.uid();
$$;

-- Internal companies the current user is assigned to ----------------------
create or replace function public.current_assigned_companies()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct company_id), '{}'::uuid[])
  from public.company_assignments
  where internal_user_id = auth.uid();
$$;

-- Combined access list: companies the current user can see ---------------
-- Internal admins see all (returns NULL → policy treats as wildcard)
-- Internal non-admins see assigned companies
-- Customers see their member companies
create or replace function public.accessible_company_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_audience public.audience;
  v_role     public.internal_role;
begin
  select audience, internal_role
    into v_audience, v_role
  from public.profiles
  where id = auth.uid() and deleted_at is null and is_active;

  if v_audience is null then
    return '{}'::uuid[];
  end if;

  if v_audience = 'internal' and v_role in ('super_admin', 'admin') then
    return null;  -- wildcard: see all companies
  end if;

  if v_audience = 'internal' then
    return public.current_assigned_companies();
  end if;

  return public.current_customer_companies();
end;
$$;

-- Convenience predicate: does the current user have access to this company?
create or replace function public.can_access_company(target_company uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_companies uuid[];
begin
  v_companies := public.accessible_company_ids();
  if v_companies is null then
    return true;     -- admin
  end if;
  return target_company = any(v_companies);
end;
$$;

-- Grant execute on helpers to authenticated role ---------------------------
grant execute on function
  public.auth_user_id(),
  public.current_audience(),
  public.current_internal_role(),
  public.is_internal(),
  public.is_internal_admin(),
  public.is_super_admin(),
  public.current_customer_companies(),
  public.current_assigned_companies(),
  public.accessible_company_ids(),
  public.can_access_company(uuid)
to authenticated;
