import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Nhật ký hoạt động | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Nhật ký hoạt động"
      description="Audit log: ai làm gì, khi nào, từ đâu."
      breadcrumb={[
        { label: "Trang chủ", href: "/dashboard" },
        { label: "Quản trị hệ thống" },
        { label: "Nhật ký hoạt động" },
      ]}
      phase="3"
    />
  );
}
