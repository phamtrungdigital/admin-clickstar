import { redirect } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmailTemplateForm } from "@/components/email/email-template-form";
import { requireInternalPage, canManageCustomers } from "@/lib/auth/guards";

export const metadata = { title: "Tạo email template | Portal.Clickstar.vn" };

export default async function NewEmailTemplatePage() {
  const profile = await requireInternalPage();
  if (!canManageCustomers(profile)) redirect("/email");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Tạo email template"
        description="Soạn email mẫu cho ticket / báo cáo / onboarding. Dùng {{var}} để chèn biến."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Email", href: "/email" },
          { label: "Tạo template" },
        ]}
      />
      <EmailTemplateForm mode="create" />
    </div>
  );
}
