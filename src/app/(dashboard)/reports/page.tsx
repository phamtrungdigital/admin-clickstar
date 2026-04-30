import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Báo cáo | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Báo cáo"
      description="Báo cáo tháng cho khách hàng và tổng hợp KPI nội bộ."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Báo cáo" }]}
      phase="2"
    />
  );
}
