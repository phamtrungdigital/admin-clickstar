import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, Pencil } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { TemplateEditor } from "@/components/templates/template-editor";
import { getTemplateById } from "@/lib/queries/templates";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Template chi tiết | Portal.Clickstar.vn" };

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireInternalPage();
  const canManage =
    profile.internal_role === "super_admin" || profile.internal_role === "admin";

  const template = await getTemplateById(id).catch(() => null);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description={template.description ?? undefined}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Template dịch vụ", href: "/templates" },
          { label: template.name },
        ]}
        actions={
          <>
            <Link
              href="/templates"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-4",
              )}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Quay lại
            </Link>
            {canManage && (
              <Link
                href={`/templates/${template.id}/edit`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "px-4",
                )}
              >
                <Pencil className="mr-2 h-4 w-4" /> Sửa thông tin
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
        <Stat label="Phiên bản" value={`v${template.version}`} />
        <Stat
          label="Ngành dịch vụ"
          value={template.industry ?? "—"}
        />
        <Stat
          label="Thời lượng"
          value={template.duration_days ? `${template.duration_days} ngày` : "—"}
        />
        <Stat
          label="Trạng thái"
          value={template.is_active ? "Đang dùng" : "Tạm ngưng"}
          tone={template.is_active ? "emerald" : "amber"}
        />
        <Stat
          label="Số milestone"
          value={template.milestones.length}
        />
        <Stat label="Số task" value={template.tasks.length} />
        <Stat
          label="Tạo lúc"
          value={format(new Date(template.created_at), "dd/MM/yyyy")}
        />
        <Stat
          label="Cập nhật"
          value={format(new Date(template.updated_at), "dd/MM/yyyy")}
        />
      </div>

      <TemplateEditor template={template} canManage={canManage} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "emerald" | "amber";
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-medium",
          tone === "emerald" && "text-emerald-700",
          tone === "amber" && "text-amber-700",
          !tone && "text-slate-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
