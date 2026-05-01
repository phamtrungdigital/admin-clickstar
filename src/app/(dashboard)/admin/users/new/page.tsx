import { PageHeader } from "@/components/dashboard/page-header";
import { UserForm } from "@/components/admin/user-form";

export const metadata = { title: "Thêm tài khoản | Portal.Clickstar.vn" };

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Thêm tài khoản"
        description="Tạo người dùng mới — admin set mật khẩu khởi tạo, user đổi sau khi đăng nhập lần đầu."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Người dùng", href: "/admin/users" },
          { label: "Thêm" },
        ]}
      />
      <UserForm mode="create" />
    </div>
  );
}
