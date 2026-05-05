-- 0048_comment_edits.sql
--
-- Cho phép tác giả sửa comment trong vòng 5 phút sau khi gửi (giống
-- Slack). Thêm cột edited_at riêng — không dùng updated_at vì trigger
-- set_updated_at đã tick cho mọi UPDATE (kể cả soft delete), không
-- distinguish được "thật sự edit body" vs "system update".
--
-- Window 5 phút enforce ở server action (lib/validation/comments.ts).
-- DB không cần check vì admin có thể cần edit retro nếu KH yêu cầu.

alter table public.milestone_comments
  add column if not exists edited_at timestamptz;
alter table public.task_comments
  add column if not exists edited_at timestamptz;
alter table public.ticket_comments
  add column if not exists edited_at timestamptz;

comment on column public.milestone_comments.edited_at is
  'Set khi tác giả sửa body trong window 5 phút. NULL = chưa từng edit. UI hiện badge "đã sửa" dựa vào trường này.';
comment on column public.task_comments.edited_at is
  'Set khi tác giả sửa body. NULL = chưa từng edit.';
comment on column public.ticket_comments.edited_at is
  'Set khi tác giả sửa body. NULL = chưa từng edit.';
