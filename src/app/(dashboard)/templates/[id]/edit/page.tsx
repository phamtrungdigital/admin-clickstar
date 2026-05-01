import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { TemplateForm } from "@/components/templates/template-form";
import { getTemplateById } from "@/lib/queries/templates";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Sửa template | Portal.Clickstar.vn" };

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireInternalPage();
  if (
    profile.internal_role !== "super_admin" &&
    profile.internal_role !== "admin"
  ) {
    redirect(`/templates/${id}`);
  }
  const template = await getTemplateById(id).catch(() => null);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Sửa template: ${template.name}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Template dịch vụ", href: "/templates" },
          { label: template.name, href: `/templates/${template.id}` },
          { label: "Sửa thông tin" },
        ]}
      />
      <TemplateForm
        mode="edit"
        templateId={template.id}
        defaultValues={{
          name: template.name,
          industry: template.industry ?? "",
          description: template.description ?? "",
          duration_days: template.duration_days ?? 90,
          is_active: template.is_active,
        }}
      />
    </div>
  );
}
