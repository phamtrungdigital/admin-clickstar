import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import {
  ReportForm,
  type ProjectOption,
} from "@/components/reports/report-form";
import { getReportById } from "@/lib/queries/reports";
import { createClient } from "@/lib/supabase/server";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Sửa báo cáo | Portal.Clickstar.vn" };

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalPage();
  const { id } = await params;
  const report = await getReportById(id).catch(() => null);
  if (!report) notFound();
  if (report.status !== "draft" && report.status !== "rejected") {
    redirect(`/reports/${id}`);
  }
  const projects = await loadProjects();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Sửa báo cáo: ${report.title}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Báo cáo", href: "/reports" },
          { label: report.title, href: `/reports/${report.id}` },
          { label: "Sửa" },
        ]}
      />
      <ReportForm
        mode="edit"
        reportId={report.id}
        projects={projects}
        defaultValues={{
          project_id: report.project_id ?? "",
          title: report.title,
          description: report.description ?? "",
          period_start: report.period_start ?? "",
          period_end: report.period_end ?? "",
          content: report.content ?? "",
        }}
      />
    </div>
  );
}

async function loadProjects(): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, company:companies!projects_company_id_fkey ( name )")
    .is("deleted_at", null)
    .order("name");
  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    company: { name: string } | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    company_name: r.company?.name ?? null,
  }));
}
