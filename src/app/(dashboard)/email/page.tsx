import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Email Marketing | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Email Marketing"
      description="Quản lý template, chiến dịch và log gửi email qua Resend."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Email Marketing" }]}
      phase="2"
    />
  );
}
