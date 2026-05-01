-- 0024_p4_reports.sql
-- Phase 4.2 (PRD §10, §13): periodic project reports — PM viết Markdown,
-- sếp duyệt, khách đọc/download. Builds on the existing `reports` table
-- from 0008 by adding the lifecycle columns + Markdown body.
--
-- Existing columns kept: id, company_id, contract_id, project_id, title,
-- description, period_start, period_end, document_id (final PDF, optional),
-- highlights jsonb, is_published, published_at, metadata, soft delete,
-- created_by.

-- 1) Status enum --------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum (
      'draft',             -- PM đang biên soạn
      'pending_approval',  -- chờ sếp duyệt
      'approved',          -- đã duyệt, customer đọc được
      'rejected'           -- bị từ chối, không hiển thị customer
    );
  end if;
end$$;

-- 2) Extend reports table -----------------------------------------------
alter table public.reports
  add column if not exists content text;
alter table public.reports
  add column if not exists status public.report_status not null default 'draft';
alter table public.reports
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.reports
  add column if not exists approved_at timestamptz;
alter table public.reports
  add column if not exists rejected_reason text;

create index if not exists reports_status_idx
  on public.reports (status)
  where deleted_at is null;
create index if not exists reports_project_status_idx
  on public.reports (project_id, status, created_at desc)
  where deleted_at is null;

-- 3) RLS ----------------------------------------------------------------
-- Reports already had RLS in 0011 — internal staff (read+modify), customer
-- (read where is_published). The new lifecycle changes how customer sees
-- "published": only status in (approved) AND is_published, not just is_published.
-- We rewrite the customer SELECT policy so a draft/pending_approval/rejected
-- report never leaks even if is_published got set accidentally.

drop policy if exists reports_select_customer on public.reports;
create policy reports_select_customer on public.reports
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and reports.status = 'approved'
    and reports.is_published = true
    and public.can_access_company(reports.company_id)
  );

-- Internal SELECT/modify policies from 0011 stay as-is (any internal staff
-- with company access can read; same plus is_internal can write).
