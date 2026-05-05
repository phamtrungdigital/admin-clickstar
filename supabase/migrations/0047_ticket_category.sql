-- 0047_ticket_category.sql
--
-- Phân loại ticket khi KH submit để team Clickstar route đúng người
-- xử lý + thống kê tỉ trọng issue. 4 category cố định (anh chốt
-- 2026-05-05): kỹ thuật / nội dung / tài khoản / khác. KH bắt buộc
-- chọn khi submit (UI enforce); old tickets giữ NULL không break.

alter table public.tickets
  add column if not exists category text
  check (category in ('technical', 'content', 'account', 'other'))
  default null;

create index if not exists tickets_category_idx
  on public.tickets (category)
  where category is not null;

comment on column public.tickets.category is
  'Phân loại ticket: technical=kỹ thuật, content=nội dung/SEO, account=tài khoản, other=khác. NULL chỉ cho ticket cũ trước migration.';
