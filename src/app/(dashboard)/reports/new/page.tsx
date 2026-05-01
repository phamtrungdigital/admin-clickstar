import { PageHeader } from "@/components/dashboard/page-header";
import {
  ReportForm,
  type ProjectOption,
} from "@/components/reports/report-form";
import { createClient } from "@/lib/supabase/server";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Tạo báo cáo | Portal.Clickstar.vn" };

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  await requireInternalPage();
  const sp = await searchParams;
  const projects = await loadProjects();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Tạo báo cáo định kỳ"
        description="Soạn báo cáo Markdown. Sau khi lưu, bấm Submit ở trang chi tiết để gửi sếp duyệt."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Báo cáo", href: "/reports" },
          { label: "Tạo mới" },
        ]}
      />
      <ReportForm
        mode="create"
        projects={projects}
        defaultValues={{ project_id: sp.project ?? "" }}
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
