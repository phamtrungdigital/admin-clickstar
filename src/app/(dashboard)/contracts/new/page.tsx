import { PageHeader } from "@/components/dashboard/page-header";
import { ContractForm } from "@/components/contracts/contract-form";
import {
  listActiveCompaniesForSelect,
  listActiveServicesForSelect,
} from "@/lib/queries/contracts";
import { createClient } from "@/lib/supabase/server";
import type { TemplateOption } from "@/components/contracts/contract-services-editor";

export const metadata = { title: "Thêm hợp đồng | Portal.Clickstar.vn" };

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const sp = await searchParams;
  const [companies, services, templates] = await Promise.all([
    listActiveCompaniesForSelect().catch(() => []),
    listActiveServicesForSelect().catch(() => []),
    loadTemplateOptions().catch(() => [] as TemplateOption[]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Thêm hợp đồng"
        description="Tạo hợp đồng + chọn template triển khai. Nếu chọn template, hệ thống tự fork thành dự án ngay sau khi lưu."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Hợp đồng", href: "/contracts" },
          { label: "Thêm hợp đồng" },
        ]}
      />
      <ContractForm
        mode="create"
        companies={companies}
        services={services}
        templates={templates}
        defaultValues={sp.company ? { company_id: sp.company } : undefined}
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
