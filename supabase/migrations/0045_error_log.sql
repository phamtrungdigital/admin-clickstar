-- 0045_error_log.sql
--
-- Bảng error_log — observability self-hosted, không cần Sentry/Axiom
-- ở giai đoạn này. Capture mọi lỗi từ server actions / notify chain /
-- background jobs để admin có thể audit hậu quả mà không cần dùng
-- Vercel function logs (vốn không reliable + không lưu lâu).
--
-- Pattern dùng: thay `console.error(...)` + `.catch(() => {})` bằng
-- `await logError("category", err, { context })`. Best-effort write,
-- không throw.

create table if not exists public.error_log (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,        -- vd 'notify.milestone', 'action.task.comment'
  message       text not null,        -- err.message
  stack         text,                 -- err.stack (truncate ở app)
  context       jsonb not null default '{}'::jsonb,  -- request data, user_id, entity_id...
  user_id       uuid,                 -- actor nếu có (qua auth.uid())
  request_path  text,                 -- vd '/projects/abc'
  created_at    timestamptz not null default now()
);

create index if not exists error_log_created_idx
  on public.error_log (created_at desc);
create index if not exists error_log_category_idx
  on public.error_log (category, created_at desc);

-- RLS: chỉ super_admin / admin đọc (admin tier — manager không cần thấy
-- noise level này). Insert không có policy → chỉ service_role ghi qua
-- adminClient (giống notifications table pattern).
alter table public.error_log enable row level security;

drop policy if exists error_log_select_admin on public.error_log;
create policy error_log_select_admin on public.error_log
  for select to authenticated
  using (
    public.is_internal()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.internal_role in ('super_admin', 'admin')
    )
  );

comment on table public.error_log is
  'Self-hosted error log. Insert qua service_role; select chỉ super_admin/admin. Replace silent catches để vận hành không bay mù.';
