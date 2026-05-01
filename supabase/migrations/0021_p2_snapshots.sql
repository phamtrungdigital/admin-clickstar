-- 0021_p2_snapshots.sql
-- Phase 2.1: Snapshot mechanism (PRD §7).
-- Customer-facing data is gated behind approved snapshots so the customer
-- never sees raw, unmoderated state. Internal staff (or PM) creates a
-- snapshot of the customer-visible slice of a project; an admin (or
-- delegated approver) approves it; only then does the customer see it.

-- 1) Enums --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'snapshot_type') then
    create type public.snapshot_type as enum (
      'weekly',         -- snapshot tuần định kỳ (auto-publish 24h)
      'milestone',      -- milestone vừa hoàn thành (bắt buộc duyệt)
      'deliverable',    -- có sản phẩm bàn giao mới (bắt buộc duyệt)
      'extra_task'      -- task phát sinh ngoài kế hoạch (bắt buộc duyệt)
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'snapshot_status') then
    create type public.snapshot_status as enum (
      'draft',           -- PM đang biên soạn, chưa submit
      'pending_approval', -- chờ sếp/người được chỉ định duyệt
      'approved',        -- đã duyệt thủ công, customer đọc được
      'auto_published',  -- auto-publish sau 24h timeout (vẫn là customer-visible)
      'rejected',        -- bị từ chối, không hiển thị customer
      'rolled_back'      -- rollback trong 7 ngày sau publish
    );
  end if;
end$$;

-- 2) snapshots table ----------------------------------------------------
create table if not exists public.snapshots (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  contract_id     uuid not null references public.contracts(id) on delete cascade,
  type            public.snapshot_type not null,
  status          public.snapshot_status not null default 'pending_approval',
  payload         jsonb not null default '{}'::jsonb,    -- frozen customer-visible state
  notes           text,
  auto_publish_at timestamptz,    -- NULL when type requires manual approval
  rollback_until  timestamptz,    -- = approved_at + 7 days
  created_by      uuid not null references public.profiles(id) on delete restrict,
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  rejected_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists snapshots_project_idx
  on public.snapshots (project_id, created_at desc);
create index if not exists snapshots_contract_idx
  on public.snapshots (contract_id);
create index if not exists snapshots_status_idx
  on public.snapshots (status);
create index if not exists snapshots_auto_publish_idx
  on public.snapshots (auto_publish_at)
  where status = 'pending_approval' and auto_publish_at is not null;

drop trigger if exists set_snapshots_updated_at on public.snapshots;
create trigger set_snapshots_updated_at
  before update on public.snapshots
  for each row execute function public.set_updated_at();

-- 3) RLS ----------------------------------------------------------------
alter table public.snapshots enable row level security;

-- Internal staff: read all snapshots in their accessible projects
drop policy if exists snapshots_select_internal on public.snapshots;
create policy snapshots_select_internal on public.snapshots
  for select to authenticated
  using (
    public.is_internal()
    and exists (
      select 1 from public.projects p
      where p.id = snapshots.project_id
        and public.can_access_company(p.company_id)
    )
  );

-- Customers: read only approved / auto-published snapshots in their company's projects
drop policy if exists snapshots_select_customer on public.snapshots;
create policy snapshots_select_customer on public.snapshots
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and snapshots.status in ('approved', 'auto_published')
    and exists (
      select 1 from public.projects p
      where p.id = snapshots.project_id
        and public.can_access_company(p.company_id)
    )
  );

-- Internal staff: create snapshots in their accessible projects
drop policy if exists snapshots_insert_internal on public.snapshots;
create policy snapshots_insert_internal on public.snapshots
  for insert to authenticated
  with check (
    public.is_internal()
    and exists (
      select 1 from public.projects p
      where p.id = snapshots.project_id
        and public.can_access_company(p.company_id)
    )
  );

-- Internal admins: approve / reject / rollback
drop policy if exists snapshots_update_admin on public.snapshots;
create policy snapshots_update_admin on public.snapshots
  for update to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

-- 4) Auto-publish helper function -- ----------------------------------
-- Will be called by pg_cron in Phase 2.5. SECURITY DEFINER because it
-- needs to bypass per-row RLS to flip pending → auto_published.
create or replace function public.auto_publish_pending_snapshots()
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    update public.snapshots s
    set
      status = 'auto_published',
      approved_at = now(),
      rollback_until = now() + interval '7 days'
    where s.status = 'pending_approval'
      and s.auto_publish_at is not null
      and s.auto_publish_at <= now()
    returning s.id;
end$$;

grant execute on function public.auto_publish_pending_snapshots() to authenticated;
