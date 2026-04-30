import { PageHeader } from "@/components/dashboard/page-header";
import { ServiceForm } from "@/components/services/service-form";

export const metadata = { title: "Thêm dịch vụ | Portal.Clickstar.vn" };

export default function NewServicePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Thêm dịch vụ"
        description="Khai báo một dịch vụ mới để gắn vào hợp đồng khách hàng."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Dịch vụ", href: "/services" },
          { label: "Thêm dịch vụ" },
        ]}
      />
      <ServiceForm mode="create" />
    </div>
  );
}
