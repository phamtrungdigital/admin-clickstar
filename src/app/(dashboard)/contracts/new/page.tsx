import { PageHeader } from "@/components/dashboard/page-header";
import { ContractForm } from "@/components/contracts/contract-form";
import {
  listActiveCompaniesForSelect,
  listActiveServicesForSelect,
} from "@/lib/queries/contracts";

export const metadata = { title: "Thêm hợp đồng | Portal.Clickstar.vn" };

export default async function NewContractPage() {
  const [companies, services] = await Promise.all([
    listActiveCompaniesForSelect().catch(() => []),
    listActiveServicesForSelect().catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Thêm hợp đồng"
        description="Tạo hợp đồng mới và gắn các dịch vụ Clickstar cung cấp."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Hợp đồng", href: "/contracts" },
          { label: "Thêm hợp đồng" },
        ]}
      />
      <ContractForm mode="create" companies={companies} services={services} />
    </div>
  );
}
