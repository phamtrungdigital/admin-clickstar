-- Seed data — Clickstar service catalog
-- Idempotent: re-running will not duplicate rows (uses code as unique key).
-- Apply by either:
--   1) Pasting into Supabase SQL Editor, or
--   2) POST to /rest/v1/services with Prefer: resolution=ignore-duplicates,
--      using SUPABASE_SERVICE_ROLE_KEY (see scripts/seed-services.mjs).

insert into public.services (code, name, category, description, default_price, billing_cycle, is_active)
values
  ('SEO-FULL',    'SEO Tổng thể',          'SEO',                    'Triển khai SEO toàn site: từ khóa, on-page, off-page, technical, báo cáo hàng tháng.', 8000000,  'Hàng tháng',  true),
  ('SEO-AUDIT',   'SEO Audit',             'SEO',                    'Kiểm tra chuyên sâu hiện trạng SEO website, đề xuất lộ trình tối ưu.',                  5000000,  '1 lần',       true),
  ('ADS-GG',      'Google Ads',            'Quảng cáo',              'Quản lý chiến dịch Google Search/Display/Shopping/YouTube. Phí dịch vụ chưa gồm budget chạy ads.', 5000000,  'Hàng tháng',  true),
  ('ADS-FB',      'Facebook Ads',          'Quảng cáo',              'Quản lý chiến dịch Facebook/Instagram Ads. Phí dịch vụ chưa gồm budget chạy ads.',          5000000,  'Hàng tháng',  true),
  ('WEB-DESIGN',  'Thiết kế website',      'Thiết kế & Website',     'Thiết kế + lập trình website doanh nghiệp/landing page chuẩn UX, mobile-first.',         25000000, 'Theo dự án',  true),
  ('EMAIL-MKT',   'Email Marketing',       'Email Marketing',        'Lên kịch bản, thiết kế template, gửi và đo lường chiến dịch email marketing.',          3000000,  'Hàng tháng',  true),
  ('ZNS-BC',      'ZNS Broadcast',         'ZNS',                    'Gửi tin Zalo Notification Service: chăm sóc, nhắc lịch, thông báo. Tính theo số tin gửi.', 2000000,  'Hàng tháng',  true),
  ('AUTO-CHATBOT','Chatbot AI',            'Phần mềm & Automation',  'Chatbot AI tích hợp website/Zalo/Facebook trả lời tự động + bàn giao agent khi cần.',     4000000,  'Hàng tháng',  true),
  ('CONTENT-MKT', 'Content Marketing',     'Digital Marketing',      'Lập kế hoạch nội dung, sản xuất bài viết/video/hình ảnh và phân phối đa kênh.',          6000000,  'Hàng tháng',  true)
on conflict (code) do nothing;
