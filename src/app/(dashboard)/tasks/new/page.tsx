import { PageHeader } from "@/components/dashboard/page-header";
import {
  TaskForm,
  type MilestoneOption,
  type ProjectOption,
  type StaffOption,
} from "@/components/tasks/task-form";
import { createClient } from "@/lib/supabase/server";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Tạo task | Portal.Clickstar.vn" };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; milestone?: string }>;
}) {
  await requireInternalPage();
  const sp = await searchParams;
  const [projects, milestones, staff] = await Promise.all([
    loadProjects(),
    loadMilestones(),
    loadStaff(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Tạo task ad-hoc"
        description="Task ngoài template (phát sinh / nội bộ). Task từ template được tạo tự động khi fork."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Công việc", href: "/tasks" },
          { label: "Tạo mới" },
        ]}
      />
      <TaskForm
        mode="create"
        projects={projects}
        milestones={milestones}
        staff={staff}
        defaultValues={{
          project_id: sp.project ?? "",
          milestone_id: sp.milestone ?? null,
        }}
      />
    </div>
  );
}

async function loadProjects(): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, company:companies!projects_company_id_fkey ( name )",
    )
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

async function loadMilestones(): Promise<MilestoneOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("milestones")
    .select("id, project_id, code, title")
    .order("project_id, sort_order", { ascending: true });
  return (data ?? []) as MilestoneOption[];
}

async function loadStaff(): Promise<StaffOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("audience", "internal")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name");
  return (data ?? []) as StaffOption[];
}
