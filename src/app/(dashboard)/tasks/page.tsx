import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Công việc | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Công việc"
      description="List, Kanban, Calendar view của các task triển khai theo khách hàng/dự án."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Công việc" }]}
      phase="2"
    />
  );
}
