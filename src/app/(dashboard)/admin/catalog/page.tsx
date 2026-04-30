import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Danh mục | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Danh mục"
      description="Danh mục hệ thống dùng chung: ngành nghề, trạng thái, loại tài liệu, ..."
      breadcrumb={[
        { label: "Trang chủ", href: "/dashboard" },
        { label: "Quản trị hệ thống" },
        { label: "Danh mục" },
      ]}
      phase="3"
    />
  );
}
