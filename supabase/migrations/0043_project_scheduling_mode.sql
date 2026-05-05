-- 0043_project_scheduling_mode.sql
--
-- Phương án B: project-level scheduling mode để cover 3 use cases:
--   - auto: tính ngày từ template offset (mặc định, hành vi cũ)
--   - manual: copy structure nhưng dates = NULL → PM tự set sau
--   - rolling: dự án ongoing/retainer, không có deadline cuối, UI ẩn date
--
-- Existing projects giữ default 'auto' để không break behavior.

alter table public.projects
  add column if not exists scheduling_mode text not null default 'auto'
  check (scheduling_mode in ('auto', 'manual', 'rolling'));

comment on column public.projects.scheduling_mode is
  'Cách lên lịch dự án: auto (offset từ template), manual (PM tự set), rolling (ongoing không deadline).';

-- Index nhẹ để filter/list khi cần
create index if not exists projects_scheduling_mode_idx
  on public.projects (scheduling_mode)
  where deleted_at is null;
