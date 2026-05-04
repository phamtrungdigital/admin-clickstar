-- 0028_seed_email_templates_ticket.sql
-- Seed 3 email templates mặc định cho ticket events (sub-batch #1b).
-- Code-side trigger gọi sendEmail({ templateCode: "ticket_created" })...
-- Idempotent: ON CONFLICT (code) DO NOTHING — safe để chạy lại không
-- ghi đè template admin đã edit.
--
-- Variables hỗ trợ:
--   name           = recipient.full_name (admin/AM/staff)
--   customer_name  = company.name (KH ký HĐ)
--   ticket_code    = ticket.code (TKT-XXXX)
--   ticket_title   = ticket.title
--   priority       = label tiếng Việt
--   status         = label tiếng Việt (chỉ dùng cho ticket_status_changed)
--   reply_excerpt  = 200 ký tự đầu của comment (chỉ ticket_replied)
--   actor_name     = người tạo comment / đổi status
--   link           = URL đầy đủ tới /tickets/<id>

insert into public.email_templates (
  code, name, subject, html_body, text_body, variables, is_active
)
values (
  'ticket_created',
  'Ticket mới: {{customer_name}}',
  '[Clickstar] Ticket mới {{ticket_code}} từ {{customer_name}}',
  $html$<div style="font-family: -apple-system,'Segoe UI',sans-serif;max-width:560px;color:#0f172a">
<p>Xin chào {{name}},</p>
<p>Khách hàng <strong>{{customer_name}}</strong> vừa gửi 1 ticket mới:</p>
<div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;background:#f8fafc">
  <p style="margin:0;font-size:14px;color:#64748b">Mã ticket: <strong style="font-family:monospace;color:#0f172a">{{ticket_code}}</strong></p>
  <p style="margin:8px 0 0;font-size:16px;font-weight:600">{{ticket_title}}</p>
  <p style="margin:8px 0 0;font-size:14px;color:#475569">Mức ưu tiên: {{priority}}</p>
</div>
<p><a href="{{link}}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Mở ticket</a></p>
<p style="font-size:12px;color:#94a3b8;margin-top:32px">Email tự động từ Portal Clickstar — vui lòng không reply trực tiếp.</p>
</div>$html$,
  'Khách hàng {{customer_name}} vừa gửi ticket mới: {{ticket_title}} (mã {{ticket_code}}, mức {{priority}}). Mở ticket: {{link}}',
  '{"hint": "name, customer_name, ticket_code, ticket_title, priority, link"}'::jsonb,
  true
),
(
  'ticket_replied',
  'Ticket có phản hồi mới',
  '[Clickstar] {{actor_name}} vừa phản hồi ticket {{ticket_code}}',
  $html$<div style="font-family: -apple-system,'Segoe UI',sans-serif;max-width:560px;color:#0f172a">
<p>Xin chào {{name}},</p>
<p><strong>{{actor_name}}</strong> vừa phản hồi ticket <strong>{{ticket_code}}</strong> ({{ticket_title}}):</p>
<blockquote style="border-left:3px solid #cbd5e1;padding-left:12px;margin:16px 0;color:#475569;font-size:14px">
  {{reply_excerpt}}
</blockquote>
<p><a href="{{link}}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Mở ticket</a></p>
<p style="font-size:12px;color:#94a3b8;margin-top:32px">Email tự động từ Portal Clickstar.</p>
</div>$html$,
  '{{actor_name}} vừa phản hồi ticket {{ticket_code}}: {{reply_excerpt}}. Mở ticket: {{link}}',
  '{"hint": "name, actor_name, ticket_code, ticket_title, reply_excerpt, link"}'::jsonb,
  true
),
(
  'ticket_status_changed',
  'Ticket đổi trạng thái',
  '[Clickstar] Ticket {{ticket_code}} chuyển sang "{{status}}"',
  $html$<div style="font-family: -apple-system,'Segoe UI',sans-serif;max-width:560px;color:#0f172a">
<p>Xin chào {{name}},</p>
<p>Ticket <strong>{{ticket_code}}</strong> ({{ticket_title}}) đã chuyển sang trạng thái mới:</p>
<div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;background:#f8fafc;text-align:center">
  <p style="margin:0;font-size:18px;font-weight:600;color:#2563eb">{{status}}</p>
</div>
<p><a href="{{link}}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Mở ticket</a></p>
<p style="font-size:12px;color:#94a3b8;margin-top:32px">Email tự động từ Portal Clickstar.</p>
</div>$html$,
  'Ticket {{ticket_code}} ({{ticket_title}}) đã chuyển sang "{{status}}". Mở ticket: {{link}}',
  '{"hint": "name, ticket_code, ticket_title, status, link"}'::jsonb,
  true
)
on conflict (code) do nothing;
