-- 0042_fix_customer_see_staff_security_definer.sql
--
-- Bug: Policy profiles_select_customer_assigned_staff (0039) có subquery
-- vào company_assignments + company_members, NHƯNG cả 2 table này có
-- RLS chặn customer:
--   - company_assignments_select: is_internal() only
--   - company_members: chỉ thấy bản thân (modifying admin only) — chưa
--     test full
--
-- Subquery chạy với role authenticated → RLS lồng nhau kích hoạt → trả
-- 0 rows → EXISTS false → policy 0039 fail → customer không thấy PM.
--
-- Fix: tách logic check thành SECURITY DEFINER function bypass RLS lồng,
-- chỉ kiểm tra logic đúng (staff được assigned ở 1 company mà user là
-- member). Function chỉ trả boolean — không lộ data cấu hình.

create or replace function public.customer_can_see_staff(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.company_assignments ca
    join public.company_members cm on cm.company_id = ca.company_id
    where ca.internal_user_id = p_staff_id
      and cm.user_id = auth.uid()
  );
$$;

grant execute on function public.customer_can_see_staff(uuid) to authenticated;

-- Re-create policy 0039 dùng function thay vì subquery trực tiếp
drop policy if exists profiles_select_customer_assigned_staff on public.profiles;
create policy profiles_select_customer_assigned_staff on public.profiles
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and audience = 'internal'
    and is_active
    and deleted_at is null
    and (
      internal_role in ('super_admin', 'admin')
      or public.customer_can_see_staff(public.profiles.id)
    )
  );

comment on function public.customer_can_see_staff(uuid) is
  'Customer được thấy staff khi staff có company_assignment cho 1 company mà customer là member. SECURITY DEFINER bypass RLS lồng trên company_assignments.';
