import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Khách hàng | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Khách hàng"
      description="Quản lý danh sách khách hàng, gắn nhân sự phụ trách, theo dõi trạng thái triển khai."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Khách hàng" }]}
      phase="C"
    />
  );
}
