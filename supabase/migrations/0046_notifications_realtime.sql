-- 0046_notifications_realtime.sql
--
-- Enable Supabase Realtime broadcast cho table notifications. Khi có row
-- mới insert, client subscribe channel sẽ nhận event và auto-update
-- chuông badge mà không cần F5.
--
-- RLS notifications_select_self đã giới hạn user chỉ thấy noti của họ
-- → Realtime cũng tôn trọng RLS, mỗi user chỉ nhận event cho row có
-- user_id = auth.uid().

alter publication supabase_realtime add table public.notifications;
