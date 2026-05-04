import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import {
  TaskForm,
  type MilestoneOption,
  type ProjectOption,
  type StaffOption,
} from "@/components/tasks/task-form";
import { getTaskById } from "@/lib/queries/tasks";
import { createClient } from "@/lib/supabase/server";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Sửa đầu việc | Portal.Clickstar.vn" };

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalPage();
  const { id } = await params;
  const task = await getTaskById(id).catch(() => null);
  if (!task) notFound();

  const [projects, milestones, staff] = await Promise.all([
    loadProjects(),
    loadMilestones(),
    loadStaff(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`Sửa đầu việc: ${task.title}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Đầu việc", href: "/tasks" },
          { label: task.title, href: `/tasks/${task.id}` },
          { label: "Sửa" },
        ]}
      />
      <TaskForm
        mode="edit"
        taskId={task.id}
        projects={projects}
        milestones={milestones}
        staff={staff}
        defaultValues={{
          project_id: task.project_id ?? "",
          milestone_id: task.milestone_id,
          title: task.title,
          description: task.description ?? "",
          assignee_id: task.assignee_id,
          reviewer_id: task.reviewer_id,
          due_at: task.due_at
            ? new Date(task.due_at).toISOString().slice(0, 16)
            : "",
          priority: task.priority,
          is_visible_to_customer: task.is_visible_to_customer,
          is_extra: task.is_extra,
          extra_source: task.extra_source,
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
