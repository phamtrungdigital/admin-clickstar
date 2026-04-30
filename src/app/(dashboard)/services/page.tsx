import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Dịch vụ | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Dịch vụ"
      description="Danh sách dịch vụ Clickstar đang cung cấp và trạng thái triển khai theo từng khách hàng."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Dịch vụ" }]}
      phase="2"
    />
  );
}
