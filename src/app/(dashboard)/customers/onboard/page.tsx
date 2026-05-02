import { PageHeader } from "@/components/dashboard/page-header";
import { OnboardWizard } from "@/components/onboard/onboard-wizard";
import {
  listActiveServicesGrouped,
  listInternalStaff,
} from "@/lib/queries/customers";
import { listActiveServicesForSelect } from "@/lib/queries/contracts";
import { createClient } from "@/lib/supabase/server";
import type { TemplateOption } from "@/components/contracts/contract-services-editor";
import { requireInternalPage, canManageCustomers } from "@/lib/auth/guards";

export const metadata = { title: "Onboard khách hàng | Portal.Clickstar.vn" };

export default async function OnboardPage() {
  const profile = await requireInternalPage();
  const [staff, customerServices, contractServices, templates] = await Promise.all([
    listInternalStaff().catch(() => []),
    listActiveServicesGrouped().catch(() => []),
    listActiveServicesForSelect().catch(() => []),
    loadTemplateOptions().catch(() => [] as TemplateOption[]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Onboard khách hàng nhanh"
        description="Tạo khách hàng + hợp đồng + dự án (fork template) trong cùng 1 luồng. Bước Hợp đồng / Dịch vụ có thể bỏ qua nếu chưa cần."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Khách hàng", href: "/customers" },
          { label: "Onboard nhanh" },
        ]}
      />
      <OnboardWizard
        staff={staff}
        customerServices={customerServices}
        contractServices={contractServices}
        templates={templates}
        currentUserId={profile.id}
        canChooseManager={canManageCustomers(profile)}
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
