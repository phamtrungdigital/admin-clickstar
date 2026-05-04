-- Partial index cho query "count unread notifications" chạy mỗi page nav
-- ở DashboardLayout. Filter điều kiện `read_at is null` → partial index
-- chỉ chứa rows chưa đọc (subset rất nhỏ vs total) → query nhanh hơn
-- nhiều so với full B-tree.
--
-- Index hiện tại 0008_ops.sql có notifications_user_idx (user_id,
-- created_at desc) cho list query, KHÔNG cover được unread filter.

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

comment on index public.notifications_user_unread_idx is
  'Partial index cho bell badge count query — read_at IS NULL filter';
