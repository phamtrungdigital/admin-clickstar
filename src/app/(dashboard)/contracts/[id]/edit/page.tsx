import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { ContractForm } from "@/components/contracts/contract-form";
import {
  getContractById,
  listActiveCompaniesForSelect,
  listActiveServicesForSelect,
} from "@/lib/queries/contracts";
import type { ContractServiceLineInput } from "@/lib/validation/contracts";

export const metadata = { title: "Sửa hợp đồng | Portal.Clickstar.vn" };

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contract, companies, services] = await Promise.all([
    getContractById(id).catch(() => null),
    listActiveCompaniesForSelect().catch(() => []),
    listActiveServicesForSelect().catch(() => []),
  ]);

  if (!contract) notFound();

  const serviceLines: ContractServiceLineInput[] = contract.services.map((s) => ({
    service_id: s.service_id,
    starts_at: s.starts_at ?? "",
    ends_at: s.ends_at ?? "",
    notes: s.notes ?? "",
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Chỉnh sửa: ${contract.name}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Hợp đồng", href: "/contracts" },
          { label: contract.name, href: `/contracts/${contract.id}` },
          { label: "Chỉnh sửa" },
        ]}
      />
      <ContractForm
        mode="edit"
        contractId={contract.id}
        companies={companies}
        services={services}
        defaultValues={{
          name: contract.name,
          code: contract.code ?? "",
          company_id: contract.company_id,
          status: contract.status,
          signed_at: contract.signed_at ?? "",
          starts_at: contract.starts_at ?? "",
          ends_at: contract.ends_at ?? "",
          notes: contract.notes ?? "",
          attachment_url: contract.attachment_url ?? "",
          attachment_filename: contract.attachment_filename ?? "",
          services: serviceLines,
        }}
      />
    </div>
  );
}
