import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type StaffFeedbackItem = {
  source: "milestone" | "task";
  comment_id: string;
  body: string;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role_label: "Admin" | "Manager" | "Khách hàng";
  };
  context: {
    project_id: string;
    project_name: string;
    /** Title của milestone hoặc task để hiện trong feed */
    item_title: string;
    /** Link đến chỗ comment: /projects/<pid>#milestone-<mid> hoặc /tasks/<tid> */
    href: string;
  };
};

/**
 * Lấy comment "đáng chú ý" cho 1 nhân viên — feedback từ admin/manager
 * hoặc khách hàng trong các milestone/task mà nhân viên đang phụ trách.
 *
 * Scope:
 *   - Milestone comments: milestone có active completion completed_by =
 *     userId, OR milestone thuộc project có pm_id = userId, OR milestone
 *     có task assigned to userId.
 *   - Task comments: task có assignee_id = userId hoặc reporter_id =
 *     userId.
 *
 * Filter:
 *   - author_id != userId (không show comment của chính mình)
 *   - author là internal admin/super_admin/manager HOẶC khách hàng
 *   - created_at > now() - daysBack (default 7)
 *   - deleted_at IS NULL
 *
 * Order: created_at desc, limit 10.
 */
export async function listStaffFeedback(
  userId: string,
  daysBack = 7,
  limit = 10,
): Promise<StaffFeedbackItem[]> {
  const admin = createAdminClient();
  const sinceIso = new Date(Date.now() - daysBack * 86_400_000).toISOString();

  // 1) Milestones liên quan đến nhân viên
  // (a) milestone có completion = userId
  const { data: completedRows } = await admin
    .from("milestone_completions")
    .select("milestone_id")
    .eq("completed_by", userId)
    .is("undone_at", null)
    .is("reopened_at", null);

  // (b) project có pm_id = userId → tất cả milestone của project đó
  const { data: pmProjects } = await admin
    .from("projects")
    .select("id")
    .eq("pm_id", userId)
    .is("deleted_at", null);
  const pmProjectIds = (pmProjects ?? []).map((p) => p.id as string);

  let pmMilestoneIds: string[] = [];
  if (pmProjectIds.length > 0) {
    const { data } = await admin
      .from("milestones")
      .select("id")
      .in("project_id", pmProjectIds);
    pmMilestoneIds = (data ?? []).map((m) => m.id as string);
  }

  // (c) milestone có task assigned to userId
  const { data: assignedTasks } = await admin
    .from("tasks")
    .select("milestone_id")
    .eq("assignee_id", userId)
    .is("deleted_at", null)
    .not("milestone_id", "is", null);
  const taskMilestoneIds = Array.from(
    new Set((assignedTasks ?? []).map((t) => t.milestone_id as string)),
  );

  const milestoneIds = Array.from(
    new Set([
      ...((completedRows ?? []).map((c) => c.milestone_id as string)),
      ...pmMilestoneIds,
      ...taskMilestoneIds,
    ]),
  );

  // 2) Task IDs mà nhân viên là assignee hoặc reporter
  const { data: myTasks } = await admin
    .from("tasks")
    .select("id")
    .or(`assignee_id.eq.${userId},reporter_id.eq.${userId}`)
    .is("deleted_at", null);
  const myTaskIds = (myTasks ?? []).map((t) => t.id as string);

  // 3) Query milestone comments
  const milestoneComments =
    milestoneIds.length === 0
      ? []
      : (
          await admin
            .from("milestone_comments")
            .select(
              `
            id, milestone_id, body, created_at, author_id,
            author:profiles!milestone_comments_author_id_fkey (
              id, full_name, avatar_url, audience, internal_role
            ),
            milestone:milestones!milestone_comments_milestone_id_fkey (
              id, title, project_id,
              project:projects!milestones_project_id_fkey (
                id, name
              )
            )
          `,
            )
            .in("milestone_id", milestoneIds)
            .neq("author_id", userId)
            .gte("created_at", sinceIso)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(limit)
        ).data ?? [];

  // 4) Query task comments
  const taskComments =
    myTaskIds.length === 0
      ? []
      : (
          await admin
            .from("task_comments")
            .select(
              `
            id, task_id, body, created_at, author_id, is_internal,
            author:profiles!task_comments_author_id_fkey (
              id, full_name, avatar_url, audience, internal_role
            ),
            task:tasks!task_comments_task_id_fkey (
              id, title, project_id,
              project:projects!tasks_project_id_fkey (
                id, name
              )
            )
          `,
            )
            .in("task_id", myTaskIds)
            .neq("author_id", userId)
            .gte("created_at", sinceIso)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(limit)
        ).data ?? [];

  // 5) Build feedback items, filter by author role
  const items: StaffFeedbackItem[] = [];

  for (const c of milestoneComments as unknown as Array<{
    id: string;
    body: string;
    created_at: string;
    author: {
      id: string;
      full_name: string;
      avatar_url: string | null;
      audience: string;
      internal_role: string | null;
    } | null;
    milestone: {
      id: string;
      title: string;
      project_id: string;
      project: { id: string; name: string } | null;
    } | null;
  }>) {
    const role = classifyAuthor(c.author);
    if (!role) continue; // không phải admin/manager/customer
    if (!c.milestone?.project) continue;
    items.push({
      source: "milestone",
      comment_id: c.id,
      body: c.body,
      created_at: c.created_at,
      author: {
        id: c.author!.id,
        full_name: c.author!.full_name,
        avatar_url: c.author!.avatar_url,
        role_label: role,
      },
      context: {
        project_id: c.milestone.project.id,
        project_name: c.milestone.project.name,
        item_title: c.milestone.title,
        href: `/projects/${c.milestone.project.id}#milestone-${c.milestone.id}`,
      },
    });
  }

  for (const c of taskComments as unknown as Array<{
    id: string;
    body: string;
    created_at: string;
    is_internal: boolean;
    author: {
      id: string;
      full_name: string;
      avatar_url: string | null;
      audience: string;
      internal_role: string | null;
    } | null;
    task: {
      id: string;
      title: string;
      project_id: string | null;
      project: { id: string; name: string } | null;
    } | null;
  }>) {
    const role = classifyAuthor(c.author);
    if (!role) continue;
    if (!c.task) continue;
    items.push({
      source: "task",
      comment_id: c.id,
      body: c.body,
      created_at: c.created_at,
      author: {
        id: c.author!.id,
        full_name: c.author!.full_name,
        avatar_url: c.author!.avatar_url,
        role_label: role,
      },
      context: {
        project_id: c.task.project?.id ?? "",
        project_name: c.task.project?.name ?? "—",
        item_title: c.task.title,
        href: `/tasks/${c.task.id}`,
      },
    });
  }

  // 6) Merge + sort + cap
  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return items.slice(0, limit);
}

function classifyAuthor(
  author: {
    audience: string;
    internal_role: string | null;
  } | null,
): "Admin" | "Manager" | "Khách hàng" | null {
  if (!author) return null;
  if (author.audience === "customer") return "Khách hàng";
  if (author.audience === "internal") {
    if (
      author.internal_role === "super_admin" ||
      author.internal_role === "admin"
    ) {
      return "Admin";
    }
    if (author.internal_role === "manager") return "Manager";
  }
  return null; // staff/support/accountant — không hiện
}
