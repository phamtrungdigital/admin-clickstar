-- 0032_milestone_comments.sql
--
-- Bảng comment cho milestone — cho phép staff được giao project bình
-- luận, thảo luận trong từng giai đoạn (PRD §6 — milestone lifecycle).
-- Pattern giống task_comments / ticket_comments.
--
-- Milestone hiện chỉ visible nội bộ (qua /projects/[id]) — chưa expose
-- ra customer view. Nên milestone_comments cũng internal-only ở giai
-- đoạn này. Nếu sau này milestone-level có channel với khách thì thêm
-- column is_internal sau (mặc định true → backward compat).

create table if not exists public.milestone_comments (
  id              uuid primary key default gen_random_uuid(),
  milestone_id    uuid not null references public.milestones(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete restrict,
  body            text not null,
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists milestone_comments_milestone_idx
  on public.milestone_comments (milestone_id, created_at desc)
  where deleted_at is null;
create index if not exists milestone_comments_author_idx
  on public.milestone_comments (author_id);

drop trigger if exists set_milestone_comments_updated_at on public.milestone_comments;
create trigger set_milestone_comments_updated_at
  before update on public.milestone_comments
  for each row execute function public.set_updated_at();

-- RLS: chỉ internal staff có access company của project mới đọc/ghi.
-- Pattern: scope qua milestones → projects → company.
alter table public.milestone_comments enable row level security;

drop policy if exists milestone_comments_select on public.milestone_comments;
create policy milestone_comments_select on public.milestone_comments
  for select to authenticated
  using (
    public.is_internal()
    and exists (
      select 1
      from public.milestones m
      join public.projects p on p.id = m.project_id
      where m.id = milestone_comments.milestone_id
        and public.can_access_company(p.company_id)
    )
  );

drop policy if exists milestone_comments_insert on public.milestone_comments;
create policy milestone_comments_insert on public.milestone_comments
  for insert to authenticated
  with check (
    public.is_internal()
    and author_id = auth.uid()
    and exists (
      select 1
      from public.milestones m
      join public.projects p on p.id = m.project_id
      where m.id = milestone_comments.milestone_id
        and public.can_access_company(p.company_id)
    )
  );

-- Author hoặc admin có thể xoá / sửa (soft delete = update deleted_at).
drop policy if exists milestone_comments_modify_own_or_admin on public.milestone_comments;
create policy milestone_comments_modify_own_or_admin on public.milestone_comments
  for update to authenticated
  using (
    public.is_internal()
    and (author_id = auth.uid() or public.is_internal_admin())
  )
  with check (
    public.is_internal()
    and (author_id = auth.uid() or public.is_internal_admin())
  );

drop policy if exists milestone_comments_delete_own_or_admin on public.milestone_comments;
create policy milestone_comments_delete_own_or_admin on public.milestone_comments
  for delete to authenticated
  using (
    public.is_internal()
    and (author_id = auth.uid() or public.is_internal_admin())
  );

comment on table public.milestone_comments is
  'Bình luận theo milestone — internal-only, scope bởi project company. Dùng cho thảo luận tiến độ giai đoạn.';
