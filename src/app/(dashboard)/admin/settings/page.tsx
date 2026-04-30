import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Cài đặt hệ thống | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Cài đặt hệ thống"
      breadcrumb={[
        { label: "Trang chủ", href: "/dashboard" },
        { label: "Quản trị hệ thống" },
        { label: "Cài đặt hệ thống" },
      ]}
      phase="3"
    />
  );
}
