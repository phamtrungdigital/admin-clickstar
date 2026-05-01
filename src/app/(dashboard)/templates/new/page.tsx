import { redirect } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { TemplateForm } from "@/components/templates/template-form";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Tạo template | Portal.Clickstar.vn" };

export default async function NewTemplatePage() {
  const profile = await requireInternalPage();
  if (
    profile.internal_role !== "super_admin" &&
    profile.internal_role !== "admin"
  ) {
    redirect("/templates");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Tạo template dịch vụ"
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Template dịch vụ", href: "/templates" },
          { label: "Tạo mới" },
        ]}
      />
      <TemplateForm mode="create" />
    </div>
  );
}
