import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Danh mục dịch vụ | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Danh mục dịch vụ"
      breadcrumb={[
        { label: "Trang chủ", href: "/dashboard" },
        { label: "Dịch vụ", href: "/services" },
        { label: "Danh mục" },
      ]}
      phase="2"
    />
  );
}
