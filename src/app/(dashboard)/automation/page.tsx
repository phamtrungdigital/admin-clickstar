import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Automation | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Automation"
      description="Webhook events gửi sang n8n: khách mới, hợp đồng mới, ticket mới, đến hạn báo cáo, ..."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Automation" }]}
      phase="3"
    />
  );
}
