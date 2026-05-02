-- 0026_customers_open_insert_for_all_internal.sql
-- Mode B follow-up (PRD §3 + business decision 2026-05-02):
--   * Any internal staff can CREATE a customer (companies row) and assign
--     themselves as the primary Account Manager. Server action enforces
--     auto-AM = creator for staff/support/accountant tier.
--   * UPDATE on companies / company_assignments stays scoped to companies
--     the user already has access to (via assignments).
--   * DELETE companies stays admin-only (super_admin / admin) — soft-delete
--     happens via UPDATE deleted_at; the server action layer guards this
--     with canManageCustomers().
--
-- Old policies restricted INSERT/UPDATE/DELETE to is_internal_admin(),
-- which blocked nhân viên Test (role=staff) with:
--   "new row violates row-level security policy for table 'companies'".

------------------------------------------------------------------------------
-- companies
------------------------------------------------------------------------------
drop policy if exists companies_modify_internal_admin on public.companies;

drop policy if exists companies_insert_internal on public.companies;
create policy companies_insert_internal on public.companies
  for insert to authenticated
  with check (public.is_internal());

drop policy if exists companies_update_internal on public.companies;
create policy companies_update_internal on public.companies
  for update to authenticated
  using (public.is_internal() and public.can_access_company(id))
  with check (public.is_internal() and public.can_access_company(id));

drop policy if exists companies_delete_admin on public.companies;
create policy companies_delete_admin on public.companies
  for delete to authenticated
  using (public.is_internal_admin());

------------------------------------------------------------------------------
-- company_assignments  (internal staff ↔ company)
------------------------------------------------------------------------------
-- Internal staff need INSERT to create the initial primary AM assignment
-- when they create a customer. UPDATE / DELETE require an existing access
-- relationship (so a random staffer can't reshuffle other teams' AMs).
drop policy if exists company_assignments_modify_admin on public.company_assignments;

drop policy if exists company_assignments_insert_internal on public.company_assignments;
create policy company_assignments_insert_internal on public.company_assignments
  for insert to authenticated
  with check (public.is_internal());

drop policy if exists company_assignments_update_internal on public.company_assignments;
create policy company_assignments_update_internal on public.company_assignments
  for update to authenticated
  using (public.is_internal() and public.can_access_company(company_id))
  with check (public.is_internal() and public.can_access_company(company_id));

drop policy if exists company_assignments_delete_internal on public.company_assignments;
create policy company_assignments_delete_internal on public.company_assignments
  for delete to authenticated
  using (public.is_internal() and public.can_access_company(company_id));
