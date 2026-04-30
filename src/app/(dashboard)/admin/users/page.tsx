import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Người dùng | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Quản lý người dùng"
      description="Tạo, phân quyền, khoá tài khoản nội bộ Clickstar và khách hàng."
      breadcrumb={[
        { label: "Trang chủ", href: "/dashboard" },
        { label: "Quản trị hệ thống" },
        { label: "Người dùng" },
      ]}
      phase="C"
    />
  );
}
