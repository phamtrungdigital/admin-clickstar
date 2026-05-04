-- 0038_seed_email_template_customer_welcome.sql
--
-- Seed email template "customer_welcome" — bắn khi admin tạo khách hàng
-- mới và auto-provision tài khoản portal cho họ. Email kèm:
--   - Lời chào mừng + giới thiệu portal
--   - Email đăng nhập + mật khẩu tạm
--   - Link login + hướng dẫn đổi mật khẩu lần đầu
--
-- Vars: company_name, contact_name, login_email, login_password, login_url
--
-- Admin có thể edit nội dung qua /email/templates/<id>/edit (Marketing &
-- Automation).

insert into public.email_templates (code, name, subject, html_body, text_body, is_active)
values (
  'customer_welcome',
  'Chào mừng khách hàng (auto-provision)',
  '🎉 Chào mừng {{company_name}} đến với Clickstar Portal',
  $html$
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="margin:0;font-size:22px;color:#0f172a;letter-spacing:-0.01em">
      Chào mừng đến với Clickstar Portal
    </h1>
    <p style="margin:8px 0 0;font-size:14px;color:#64748b">
      Cổng dịch vụ và quản lý dự án dành cho khách hàng
    </p>
  </div>

  <p style="margin:0 0 16px;line-height:1.6">
    Xin chào <strong>{{contact_name}}</strong>,
  </p>
  <p style="margin:0 0 16px;line-height:1.6">
    Clickstar đã tạo tài khoản truy cập portal cho doanh nghiệp
    <strong>{{company_name}}</strong>. Tại đây bạn có thể:
  </p>
  <ul style="margin:0 0 24px;padding-left:20px;line-height:1.7;color:#334155">
    <li>Theo dõi tiến độ các <strong>dự án</strong> Clickstar đang triển khai</li>
    <li>Xem <strong>tài liệu</strong> bàn giao và bản tổng hợp công việc</li>
    <li>Gửi <strong>yêu cầu hỗ trợ</strong> và trao đổi với đội ngũ phụ trách</li>
    <li>Quản lý các <strong>thành viên</strong> trong doanh nghiệp được truy cập portal</li>
  </ul>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0">
    <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">
      Thông tin đăng nhập
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr>
        <td style="padding:8px 0;color:#64748b;width:130px">Email:</td>
        <td style="padding:8px 0">
          <code style="background:#fff;border:1px solid #e2e8f0;padding:2px 8px;border-radius:4px;font-family:Menlo,Monaco,Consolas,monospace">{{login_email}}</code>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748b">Mật khẩu tạm:</td>
        <td style="padding:8px 0">
          <code style="background:#fef3c7;border:1px solid #fcd34d;padding:2px 8px;border-radius:4px;font-family:Menlo,Monaco,Consolas,monospace;font-weight:600">{{login_password}}</code>
        </td>
      </tr>
    </table>
    <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;line-height:1.5">
      Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên tại Cài đặt → Mật khẩu.
    </p>
  </div>

  <p style="text-align:center;margin:32px 0">
    <a href="{{login_url}}"
       style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      Đăng nhập Portal
    </a>
  </p>

  <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e2e8f0">

  <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;text-align:center">
    Email được gửi tự động khi tài khoản được tạo. Nếu bạn không yêu cầu,
    vui lòng phản hồi email này để chúng tôi xác minh.
  </p>
  <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;text-align:center">
    © Clickstar · portal.clickstar.vn
  </p>
</div>
  $html$,
  'Chào mừng {{contact_name}} đến với Clickstar Portal!

Clickstar đã tạo tài khoản truy cập cho doanh nghiệp {{company_name}}.

Thông tin đăng nhập:
  Email: {{login_email}}
  Mật khẩu tạm: {{login_password}}

Đăng nhập tại: {{login_url}}

Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên tại Cài đặt > Mật khẩu.

— Clickstar Team',
  true
)
on conflict (code) do nothing;
