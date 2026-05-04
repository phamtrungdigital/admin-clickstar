import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmailTemplateForm } from "@/components/email/email-template-form";
import { getEmailTemplateById } from "@/lib/queries/email";
import { requireInternalPage, canManageCustomers } from "@/lib/auth/guards";

export const metadata = { title: "Sửa email template | Portal.Clickstar.vn" };

export default async function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireInternalPage();
  if (!canManageCustomers(profile)) redirect("/email");
  const { id } = await params;
  const template = await getEmailTemplateById(id).catch(() => null);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Sửa: ${template.name}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Email", href: "/email" },
          { label: template.name },
          { label: "Sửa" },
        ]}
      />
      <EmailTemplateForm
        mode="edit"
        templateId={template.id}
        defaultValues={{
          code: template.code,
          name: template.name,
          subject: template.subject,
          html_body: template.html_body,
          text_body: template.text_body ?? "",
          variables:
            (template.variables as { hint?: string } | null)?.hint ?? "",
          is_active: template.is_active,
        }}
      />
    </div>
  );
}
