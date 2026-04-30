import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Hợp đồng | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Hợp đồng"
      description="Quản lý hợp đồng dịch vụ, theo dõi giá trị, tiến độ thanh toán và phụ lục."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Hợp đồng" }]}
      phase="2"
    />
  );
}
