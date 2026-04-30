import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Vai trò & Phân quyền | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Vai trò & Phân quyền"
      description="Cấu hình ma trận quyền cho từng role nội bộ."
      breadcrumb={[
        { label: "Trang chủ", href: "/dashboard" },
        { label: "Quản trị hệ thống" },
        { label: "Vai trò & Phân quyền" },
      ]}
      phase="C"
    />
  );
}
