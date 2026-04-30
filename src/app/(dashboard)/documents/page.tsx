import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Tài liệu | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Tài liệu"
      description="Hợp đồng, phụ lục, biên bản, brief, báo cáo, file thiết kế, ... lưu trên Supabase Storage."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Tài liệu" }]}
      phase="2"
    />
  );
}
