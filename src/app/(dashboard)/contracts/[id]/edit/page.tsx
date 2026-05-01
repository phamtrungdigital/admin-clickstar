import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { ContractForm } from "@/components/contracts/contract-form";
import {
  getContractById,
  listActiveCompaniesForSelect,
  listActiveServicesForSelect,
} from "@/lib/queries/contracts";
import { createClient } from "@/lib/supabase/server";
import type { ContractServiceLineInput } from "@/lib/validation/contracts";
import type { TemplateOption } from "@/components/contracts/contract-services-editor";

export const metadata = { title: "Sửa hợp đồng | Portal.Clickstar.vn" };

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contract, companies, services, templates] = await Promise.all([
    getContractById(id).catch(() => null),
    listActiveCompaniesForSelect().catch(() => []),
    listActiveServicesForSelect().catch(() => []),
    loadTemplateOptions().catch(() => [] as TemplateOption[]),
  ]);

  if (!contract) notFound();

  const serviceLines: ContractServiceLineInput[] = contract.services.map((s) => ({
    service_id: s.service_id,
    template_id: null,
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
        templates={templates}
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

async function loadTemplateOptions(): Promise<TemplateOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_templates")
    .select("id, name, industry, duration_days, version")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []) as TemplateOption[];
}
