-- 0039_profiles_customer_see_assigned_staff.sql
--
-- Bug: Customer view thấy "PM phụ trách: Chưa gán" mặc dù admin đã set
-- pm_id cho project. Nested embed pm:profiles!fk(id, full_name) bị RLS
-- profiles block — customer chỉ có 3 policy đọc profiles hiện tại:
--   1. profiles_select_self (chính mình)
--   2. profiles_select_internal (chỉ áp với internal user)
--   3. profiles_select_customer_same_company (chỉ customer cùng company)
-- → KHÔNG có policy cho customer đọc profile của internal staff phụ
--   trách công việc cho mình.
--
-- Fix: thêm policy mới — customer được đọc profile (id + full_name +
-- avatar_url) của internal staff CÓ LIÊN QUAN tới company của họ:
--   - super_admin / admin: luôn visible (wildcard access toàn site
--     nên đối với customer họ luôn là người có thể support).
--   - manager / staff / support / accountant: chỉ visible nếu có
--     company_assignments cho 1 trong các company mà customer là
--     member (qua company_members).
--
-- Privacy: customer chỉ select các field public-safe (id, full_name,
-- avatar_url) qua các embed thông thường — không lộ email/phone của
-- staff vì query đã giới hạn columns ở app-level.

drop policy if exists profiles_select_customer_assigned_staff on public.profiles;
create policy profiles_select_customer_assigned_staff on public.profiles
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and audience = 'internal'
    and is_active
    and deleted_at is null
    and (
      -- Admin level: customer của bất kỳ company nào cũng có thể thấy
      internal_role in ('super_admin', 'admin')
      -- Hoặc staff được assigned cho company mà customer là member
      or exists (
        select 1
        from public.company_assignments ca
        join public.company_members cm on cm.company_id = ca.company_id
        where ca.internal_user_id = public.profiles.id
          and cm.user_id = auth.uid()
      )
    )
  );

comment on policy profiles_select_customer_assigned_staff on public.profiles is
  'Customer được đọc profile của internal staff phụ trách dự án/công ty của họ — để hiển thị PM phụ trách, Account Manager...';
