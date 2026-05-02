-- 0027_companies_creator_can_select.sql
-- Bug: Khi nhân viên (role=staff) tạo KH qua REST/PostgREST với
-- Prefer: return=representation, INSERT thành công nhưng RETURNING bị
-- chặn vì SELECT policy `can_access_company(id)` trả false (chưa có
-- assignment vào company vừa tạo). PostgREST trả lỗi 42501 "new row
-- violates row-level security policy".
--
-- Fix: SELECT companies cho phép creator xem chính row mình vừa tạo.
-- Sau khi server action insert tiếp company_assignments (gán AM=self),
-- can_access_company sẽ true → SELECT bình thường.

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (
    public.can_access_company(id)
    or created_by = auth.uid()
  );
