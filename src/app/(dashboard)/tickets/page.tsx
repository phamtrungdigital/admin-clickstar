import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Ticket | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Ticket"
      description="Yêu cầu hỗ trợ và quy trình xử lý CSKH cho khách hàng đã ký hợp đồng."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Ticket" }]}
      phase="2"
    />
  );
}
