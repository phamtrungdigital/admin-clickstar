# Portal.Clickstar.vn — Product Requirements

> Tên sản phẩm: **Portal.Clickstar.vn**
>
> Mục tiêu: Xây dựng cổng quản trị vận hành dịch vụ, chăm sóc khách hàng, quản lý hợp đồng, tài liệu, ticket, báo cáo tiến độ và automation cho nội bộ Clickstar và khách hàng.

## 1. Định hướng sản phẩm

Portal.Clickstar.vn **không phải CRM thuần túy**. Đây là hệ thống **Client Operation Portal** gồm:

- Quản trị khách hàng
- Quản trị hợp đồng
- Quản trị dịch vụ đã ký
- Quản trị tiến độ triển khai
- Lưu trữ tài liệu/hồ sơ
- Ticket xử lý vấn đề khách hàng
- Báo cáo tiến độ và hiệu quả
- Chăm sóc khách qua Email/ZNS
- Tự động hóa bằng n8n

**Người dùng chính:**
- Nội bộ Clickstar
- Khách hàng đã ký hợp đồng

## 2. Công nghệ sử dụng

**Frontend:** Next.js • React • Tailwind CSS • Shadcn UI • Deploy trên Vercel.

**Source code:** Github, có nhánh `main` và `dev`. Mọi tính năng code ở `dev`, test trên Vercel Preview, ổn mới merge `main`.

**Backend/Database:** Supabase (PostgreSQL + Auth + Storage + Row Level Security + Realtime nếu cần).

**Email:** Resend — gửi email hệ thống, chăm sóc, báo cáo, nhắc việc.

**ZNS:** Tích hợp Zalo OA API hoặc nhà cung cấp ZNS trung gian. Lưu trạng thái gửi, lỗi, thời gian, template.

**Automation:** n8n — webhook kết nối hệ thống, trigger theo sự kiện (khách mới, hợp đồng mới, ticket mới, đến hạn báo cáo, cuối tháng).

**AI coding:** Claude Code hỗ trợ build module, refactor, tạo component, xử lý bug.

## 3. Phân quyền người dùng

### Nhóm nội bộ Clickstar
- **Super Admin:** toàn quyền
- **Admin:** quản trị hệ thống, người dùng, dữ liệu
- **Manager:** xem khách hàng/dự án được phân quyền, xem báo cáo, giao việc
- **Nhân viên triển khai:** xem và cập nhật công việc được giao
- **CSKH:** xem khách hàng, ticket, tương tác chăm sóc
- **Kế toán:** xem hợp đồng, thanh toán, công nợ, file liên quan

### Nhóm khách hàng
- **Owner:** xem toàn bộ dữ liệu của doanh nghiệp mình
- **Marketing Manager:** xem báo cáo, tiến độ, ticket
- **Viewer:** chỉ xem báo cáo/tài liệu được chia sẻ

### Yêu cầu bảo mật
- Khách hàng A không được thấy dữ liệu khách hàng B
- Nhân viên chỉ xem dữ liệu được phân công
- Tất cả truy cập dữ liệu phải theo `company_id` / `project_id`
- **Bắt buộc dùng Supabase RLS**

## 4. Module đăng nhập

**Chức năng:** đăng nhập email/mật khẩu • quên mật khẩu • ghi nhớ đăng nhập • phân luồng sau đăng nhập theo role (nội bộ → dashboard nội bộ; khách → portal khách hàng).

**UI:** Logo Clickstar, tabs Nội bộ / Khách hàng, form email + password, nút đăng nhập, link quên mật khẩu, thông báo lỗi rõ ràng.

## 5. Dashboard tổng quan

### Nội bộ Clickstar
Tổng khách hàng đang hoạt động • Hợp đồng đang chạy • Ticket đang mở • Công việc trễ hạn • Báo cáo tháng cần gửi • Email/ZNS đã gửi • Tỷ lệ hoàn thành công việc.

### Khách hàng
Dịch vụ đang triển khai • Tiến độ tổng quan • Hạng mục đã/đang xử lý • Ticket đang mở • Báo cáo mới nhất • Tài liệu/hợp đồng mới nhất.

## 6. Module khách hàng

**Chức năng:** Tạo / sửa / xem danh sách / tìm kiếm + lọc / gắn nhân sự phụ trách / gắn dịch vụ.

**Thông tin:** Tên doanh nghiệp • Mã khách hàng • Website • Ngành nghề • Người đại diện • Email • SĐT • Địa chỉ • MST • Trạng thái (mới / đang triển khai / tạm dừng / kết thúc) • Nhân sự phụ trách nội bộ.

## 7. Module hợp đồng

**Chức năng:** Tạo • Upload file • Gắn khách hàng • Theo dõi ngày ký/bắt đầu/kết thúc • Theo dõi giá trị + trạng thái thanh toán • Lưu phụ lục, nghiệm thu, biên bản.

**Trường:** Mã hợp đồng • Khách hàng • Dịch vụ ký kết • Giá trị • VAT • Ngày ký / bắt đầu / kết thúc • Trạng thái (nháp / đã ký / đang triển khai / hoàn thành / hủy) • File hợp đồng • Ghi chú.

## 8. Module dịch vụ / hạng mục triển khai

Mỗi hợp đồng có nhiều dịch vụ/hạng mục. Ví dụ: Thiết kế website • SEO • Facebook Ads • Google Ads • Marketing Automation • Quản trị fanpage • Email Marketing • ZNS chăm sóc.

**Chức năng:** Tạo hạng mục • Gắn hợp đồng • Gắn người phụ trách • Gắn timeline • Theo dõi trạng thái.

**Trạng thái:** Chưa bắt đầu • Đang triển khai • Chờ khách phản hồi • Chờ duyệt • Hoàn thành • Tạm dừng.

## 9. Module công việc và tiến độ

**Chức năng:** Tạo task • Gắn task vào khách hàng/dự án/hợp đồng/hạng mục • Giao người phụ trách • Đặt deadline • Cập nhật trạng thái • Comment nội bộ • Upload file • Khách xem task được chia sẻ.

**Trường:** Tên • Mô tả • Khách hàng • Dự án/hợp đồng • Hạng mục • Người phụ trách • Deadline • Mức độ ưu tiên • Trạng thái • File đính kèm • Lịch sử cập nhật.

**View:** List view • Kanban view • Calendar view nếu làm được.

## 10. Module ticket / CSKH

**Chức năng:** Khách tạo ticket • Nội bộ tạo thay khách • Gán người xử lý • Gắn mức độ ưu tiên • Cập nhật trạng thái • Comment • Upload file • Lưu lịch sử • Gửi thông báo email/ZNS khi cập nhật.

**Trạng thái:** Mới • Đang xử lý • Chờ khách phản hồi • Đã xử lý • Đóng.

**Mức độ ưu tiên:** Thấp • Trung bình • Cao • Khẩn cấp.

## 11. Module tài liệu

**Chức năng:** Upload • Phân loại • Gắn khách hàng/hợp đồng/dự án • Chia sẻ cho khách • Phân quyền file • Tải xuống • Xóa nếu có quyền.

**Loại:** Hợp đồng • Phụ lục • Biên bản nghiệm thu • Brief • Báo cáo • File thiết kế • Tài liệu quảng cáo • Tài liệu SEO • Khác.

**Yêu cầu:** File trên Supabase Storage • Metadata trong DB • Có `owner_id`, `company_id`, `project_id` • Quyền public/private/internal.

## 12. Module Email (Resend)

**Chức năng:** Tạo template • Tạo chiến dịch • Chọn nhóm khách nhận • Gửi thủ công + tự động qua n8n • Lưu log + theo dõi trạng thái gửi.

**Loại:** Onboarding khách mới • Nhắc việc • Thông báo tiến độ • Gửi báo cáo • Chăm sóc định kỳ • Nhắc thanh toán nếu cần.

**Log:** Người nhận • Tiêu đề • Template • Trạng thái • Thời gian • Lỗi • Mã chiến dịch.

## 13. Module ZNS

**Chức năng:** Quản lý template ZNS • Gửi thủ công + automation • Gửi khi cập nhật ticket / có báo cáo mới / nhắc lịch họp + việc • Lưu log.

**Log:** SĐT nhận • Template • Nội dung biến động • Trạng thái • Thời gian • Lỗi • Mã chiến dịch.

## 14. Module automation n8n

Hệ thống gửi webhook sang n8n khi có sự kiện.

**Events:** Khách hàng mới • Hợp đồng mới • Task mới được giao • Task sắp quá hạn • Ticket mới • Ticket cập nhật • Báo cáo tháng được tạo • Đến ngày gửi báo cáo • Khách không phản hồi sau X ngày.

**Workflow mẫu:** Khách mới → email onboarding • Hợp đồng mới → tạo checklist triển khai • Ticket mới → email/ZNS cho người phụ trách • Task quá hạn → nhắc nhân viên • Cuối tháng → tạo + gửi báo cáo cho khách.

**Yêu cầu kỹ thuật:** Bảng `automation_events` có `webhook_url`, trạng thái event (`pending` / `sent` / `failed` / `retried`), retry khi lỗi.

## 15. Module báo cáo

### Nội bộ
Số khách hàng • Số hợp đồng • Doanh thu • Công việc hoàn thành • Ticket tồn • Nhân sự xử lý • Tiến độ từng khách.

### Khách hàng
Tiến độ • Hạng mục đã/đang làm • Ticket đã xử lý • Email/ZNS đã gửi • Kết quả theo dịch vụ nếu có dữ liệu • File báo cáo tháng.

**Chức năng:** Tạo báo cáo tháng • Upload • Gửi email báo cáo • ZNS thông báo có báo cáo mới • Khách xem trong portal • Xuất PDF nếu làm được.

## 16. Module thông báo

**Kênh:** In-app notification • Email • ZNS.

**Sự kiện:** Có ticket mới / được phản hồi • Có báo cáo mới • Có task sắp quá hạn • Có file mới • Có hợp đồng mới • Có yêu cầu cần khách phản hồi.

## 17. Audit log (bắt buộc)

**Cần lưu:** Ai tạo / sửa / xóa dữ liệu • Ai upload/tải file • Ai gửi email/ZNS • Ai đổi trạng thái hợp đồng/ticket/task.

**Bảng `audit_logs`:** `id` • `user_id` • `action` • `entity_type` • `entity_id` • `old_value` • `new_value` • `created_at` • `ip_address` (nếu lấy được).

## 18. Database gợi ý

`users` • `user_roles` • `companies` • `contacts` • `contracts` • `services` • `projects` • `tasks` • `tickets` • `ticket_comments` • `documents` • `email_templates` • `email_campaigns` • `email_logs` • `zns_templates` • `zns_logs` • `reports` • `notifications` • `automation_events` • `audit_logs`.

**Nguyên tắc:**
- Hầu hết bảng cần có `company_id`
- Các bảng liên quan dự án cần có `project_id`
- Có `created_at`, `updated_at`, `created_by`
- Không hard delete, ưu tiên `deleted_at`

## 19. Yêu cầu UI/UX

**Phong cách:** Sạch • Hiện đại • Chuyên nghiệp • Màu chủ đạo xanh Clickstar • Nền sáng • Card bo góc • Sidebar trái • Header trên • Table rõ ràng • Filter dễ dùng • Tránh quá nhiều màu.

**Layout chính:**
- **Sidebar:** Dashboard • Khách hàng • Hợp đồng • Dịch vụ • Công việc • Ticket • Tài liệu • Email • ZNS • Báo cáo • Automation • Cài đặt
- **Header:** tìm kiếm • thông báo • avatar
- **Content:** theo từng module

## 20. Quy trình deploy

- Code trên branch `dev`
- Push GitHub → Vercel tạo preview link
- Test UI / login / CRUD / phân quyền
- Đạt mới merge `main`
- Production tự deploy từ `main`
- **Không được code thẳng production**

## 21. MVP nên làm trước

### Giai đoạn 1
Login • Phân quyền cơ bản • Quản trị khách hàng • Quản trị hợp đồng • Tài liệu • Ticket • Công việc/tiến độ • Dashboard cơ bản.

### Giai đoạn 2
Portal khách hàng • Báo cáo tháng • Email qua Resend • Notification.

### Giai đoạn 3
ZNS • n8n automation • Audit log đầy đủ • Export PDF.

### Giai đoạn 4
AI hỗ trợ báo cáo • AI tóm tắt ticket • AI gợi ý phản hồi khách • Dashboard nâng cao.

## 22. Tiêu chí hoàn thành MVP

MVP đạt khi:
- Nội bộ + khách hàng đăng nhập được
- Tạo khách hàng / hợp đồng / tài liệu / ticket / task tiến độ được
- Khách xem được dữ liệu của mình, **không** xem được dữ liệu khách khác
- Gửi được email cơ bản qua Resend
- Có dashboard tổng quan
- Deploy ổn trên Vercel
- Database có RLS bảo vệ dữ liệu

## 23. Yêu cầu cuối cho dev

Khi code cần ưu tiên:
- Bảo mật phân quyền trước
- Cấu trúc database chuẩn ngay từ đầu
- UI đơn giản nhưng sạch
- Module hóa rõ
- Dễ mở rộng automation
- Không làm quá phức tạp ở MVP
- Không hardcode dữ liệu quan trọng
- Có log lỗi và log thao tác
- Có tài liệu setup môi trường local

---

**Kết luận:** Portal.Clickstar.vn là cổng vận hành dịch vụ và chăm sóc khách hàng cho Clickstar. Giai đoạn đầu ưu tiên xây nền tảng quản trị khách hàng, hợp đồng, tài liệu, ticket, tiến độ và portal khách hàng. Sau đó mở rộng Email, ZNS, n8n automation và AI hỗ trợ báo cáo.
