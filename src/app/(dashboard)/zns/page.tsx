import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "ZNS | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="ZNS"
      description="Quản lý template Zalo Notification Service và lịch sử gửi tin tự động."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "ZNS" }]}
      phase="3"
    />
  );
}
