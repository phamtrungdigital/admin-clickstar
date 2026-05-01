"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  notifyTaskApproved,
  notifyTaskAssigned,
  notifyTaskBlocked,
  notifyTaskReturned,
  notifyTaskSubmittedForReview,
} from "@/lib/notifications/tasks";
import {
  addTaskCommentSchema,
  awaitingCustomerSchema,
  blockTaskSchema,
  createTaskSchema,
  returnTaskSchema,
  updateTaskSchema,
  upsertTaskChecklistSchema,
  type AddTaskCommentInput,
  type AwaitingCustomerInput,
  type BlockTaskInput,
  type CreateTaskInput,
  type ReturnTaskInput,
  type UpdateTaskInput,
  type UpsertTaskChecklistInput,
} from "@/lib/validation/tasks";
import type { TaskStatus } from "@/lib/database.types";

export type TaskActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function flattenZodErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ---- CRUD ----

export async function createTaskAction(
  input: CreateTaskInput,
): Promise<TaskActionResult<{ id: string }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  // Inherit company_id from project
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", parsed.data.project_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (pErr) return { ok: false, message: pErr.message };
  if (!project) return { ok: false, message: "Dự án không tồn tại" };

  const initialStatus: TaskStatus = parsed.data.assignee_id ? "assigned" : "todo";

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      company_id: project.company_id,
      project_id: parsed.data.project_id,
      milestone_id: parsed.data.milestone_id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      assignee_id: parsed.data.assignee_id,
      reviewer_id: parsed.data.reviewer_id,
      reporter_id: user.id,
      due_at: parsed.data.due_at?.length ? parsed.data.due_at : null,
      status: initialStatus,
      priority: parsed.data.priority,
      is_visible_to_customer: parsed.data.is_visible_to_customer,
      is_extra: parsed.data.is_extra,
      extra_source: parsed.data.is_extra ? parsed.data.extra_source : null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !task) {
    return { ok: false, message: error?.message ?? "Không tạo được task" };
  }

  await logAudit({
    user_id: user.id,
    company_id: project.company_id as string,
    action: "create",
    entity_type: "task",
    entity_id: task.id,
    new_value: {
      title: parsed.data.title,
      project_id: parsed.data.project_id,
      assignee_id: parsed.data.assignee_id,
      is_extra: parsed.data.is_extra,
    },
  });

  if (parsed.data.assignee_id) {
    await notifyTaskAssigned(
      {
        taskId: task.id,
        taskTitle: parsed.data.title,
        projectId: parsed.data.project_id,
        projectName: null, // skipped lookup; assignee will see project on page
        companyId: project.company_id as string,
        assigneeId: parsed.data.assignee_id,
        reviewerId: parsed.data.reviewer_id,
        reporterId: user.id,
      },
      user.id,
    );
  }

  revalidatePath("/tasks");
  revalidatePath(`/projects/${parsed.data.project_id}`);
  return { ok: true, data: { id: task.id } };
}

export async function updateTaskAction(
  id: string,
  input: UpdateTaskInput,
): Promise<TaskActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const payload: Record<string, unknown> = { ...parsed.data };
  if ("description" in payload) {
    payload.description =
      typeof payload.description === "string" && payload.description
        ? payload.description
        : null;
  }
  if ("due_at" in payload) {
    payload.due_at =
      typeof payload.due_at === "string" && payload.due_at
        ? payload.due_at
        : null;
  }
  if (payload.is_extra === false) {
    payload.extra_source = null;
  }

  const { data: row, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .select("project_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Task không tồn tại" };

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  if (row.project_id) revalidatePath(`/projects/${row.project_id as string}`);
  return { ok: true };
}

export async function softDeleteTaskAction(
  id: string,
): Promise<TaskActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

// ---- Lifecycle transitions ----

type TransitionContext = {
  expectedFrom: TaskStatus[];
  to: TaskStatus;
  rolesAllowed: "assignee" | "reviewer-or-admin" | "any-internal";
  extra?: Record<string, unknown>;
};

async function executeTransition(
  taskId: string,
  ctx: TransitionContext,
  auditDetails: Record<string, unknown>,
): Promise<TaskActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  // Read current task
  const { data: task, error: tErr } = await supabase
    .from("tasks")
    .select("id, status, assignee_id, reviewer_id, project_id, company_id")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (tErr) return { ok: false, message: tErr.message };
  if (!task) return { ok: false, message: "Task không tồn tại" };

  if (!ctx.expectedFrom.includes(task.status as TaskStatus)) {
    return {
      ok: false,
      message: `Không thể chuyển trạng thái từ "${task.status}" sang "${ctx.to}".`,
    };
  }

  // Authorization
  const role = guard.profile.internal_role;
  const isAdmin = role === "super_admin" || role === "admin";
  if (ctx.rolesAllowed === "assignee") {
    if (task.assignee_id !== user.id && !isAdmin) {
      return {
        ok: false,
        message: "Chỉ người được giao mới chuyển trạng thái này được.",
      };
    }
  } else if (ctx.rolesAllowed === "reviewer-or-admin") {
    if (task.reviewer_id !== user.id && !isAdmin) {
      return {
        ok: false,
        message: "Chỉ reviewer hoặc admin mới chuyển trạng thái này được.",
      };
    }
  }
  // "any-internal" — internal staff already passed requireInternalAction

  const updates: Record<string, unknown> = {
    status: ctx.to,
    ...(ctx.extra ?? {}),
  };
  const { error: uErr } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId);
  if (uErr) return { ok: false, message: uErr.message };

  await logAudit({
    user_id: user.id,
    company_id: task.company_id as string,
    action: "update",
    entity_type: "task",
    entity_id: taskId,
    old_value: { status: task.status },
    new_value: { status: ctx.to, ...auditDetails },
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (task.project_id) {
    revalidatePath(`/projects/${task.project_id as string}`);
  }
  return { ok: true };
}

export async function assignTaskAction(
  taskId: string,
  assigneeId: string,
  reviewerId: string | null,
): Promise<TaskActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { data: task } = await supabase
    .from("tasks")
    .select("status, project_id, company_id")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) return { ok: false, message: "Task không tồn tại" };

  // Allowed from todo / returned / assigned (re-assign)
  const allowedFrom: TaskStatus[] = ["todo", "assigned", "returned"];
  if (!allowedFrom.includes(task.status as TaskStatus)) {
    return {
      ok: false,
      message: `Không gán được khi task ở trạng thái "${task.status}".`,
    };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      assignee_id: assigneeId,
      reviewer_id: reviewerId,
      status: "assigned",
    })
    .eq("id", taskId);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user.id,
    company_id: task.company_id as string,
    action: "update",
    entity_type: "task",
    entity_id: taskId,
    old_value: { status: task.status },
    new_value: {
      status: "assigned",
      assignee_id: assigneeId,
      reviewer_id: reviewerId,
    },
  });

  // Look up task title + project name for notification body
  const { data: detail } = await supabase
    .from("tasks")
    .select(
      "title, project:projects!tasks_project_id_fkey ( id, name )",
    )
    .eq("id", taskId)
    .maybeSingle();
  const projectInfo = (detail as { project: { id: string; name: string } | null } | null)
    ?.project ?? null;
  await notifyTaskAssigned(
    {
      taskId,
      taskTitle: (detail?.title as string) ?? "Task",
      projectId: task.project_id as string | null,
      projectName: projectInfo?.name ?? null,
      companyId: task.company_id as string,
      assigneeId,
      reviewerId,
      reporterId: user.id,
    },
    user.id,
  );

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (task.project_id) revalidatePath(`/projects/${task.project_id as string}`);
  return { ok: true };
}

/**
 * Build a TaskNotificationContext from a task id by reading current task
 * + parents. Returns null if the task or project disappeared in between.
 */
async function loadTaskNotificationContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      id, title, assignee_id, reviewer_id, reporter_id, company_id, project_id,
      project:projects!tasks_project_id_fkey ( id, name )
      `,
    )
    .eq("id", taskId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as {
    id: string;
    title: string;
    assignee_id: string | null;
    reviewer_id: string | null;
    reporter_id: string | null;
    company_id: string;
    project_id: string | null;
    project: { id: string; name: string } | null;
  };
  return {
    taskId: r.id,
    taskTitle: r.title,
    projectId: r.project_id,
    projectName: r.project?.name ?? null,
    companyId: r.company_id,
    assigneeId: r.assignee_id,
    reviewerId: r.reviewer_id,
    reporterId: r.reporter_id,
  };
}

export async function startTaskAction(taskId: string): Promise<TaskActionResult> {
  return executeTransition(
    taskId,
    {
      expectedFrom: ["assigned", "blocked", "returned", "awaiting_customer"],
      to: "in_progress",
      rolesAllowed: "assignee",
    },
    { action: "start" },
  );
}

export async function submitForReviewAction(
  taskId: string,
): Promise<TaskActionResult> {
  const result = await executeTransition(
    taskId,
    {
      expectedFrom: ["in_progress"],
      to: "awaiting_review",
      rolesAllowed: "assignee",
    },
    { action: "submit" },
  );
  if (result.ok) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ctx = await loadTaskNotificationContext(supabase, taskId);
    if (ctx && user) await notifyTaskSubmittedForReview(ctx, user.id);
  }
  return result;
}

export async function approveTaskAction(
  taskId: string,
): Promise<TaskActionResult> {
  const result = await executeTransition(
    taskId,
    {
      expectedFrom: ["awaiting_review"],
      to: "done",
      rolesAllowed: "reviewer-or-admin",
    },
    { action: "approve" },
  );
  if (result.ok) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ctx = await loadTaskNotificationContext(supabase, taskId);
    if (ctx && user) await notifyTaskApproved(ctx, user.id);
  }
  return result;
}

export async function returnTaskAction(
  taskId: string,
  input: ReturnTaskInput,
): Promise<TaskActionResult> {
  const parsed = returnTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  // Drop the reason as a comment on the task so the reviewer's feedback is
  // visible in the thread, not just buried in the audit log.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("task_comments").insert({
      task_id: taskId,
      author_id: user.id,
      body: `Trả về task: ${parsed.data.reason}`,
      is_internal: true,
    });
  }
  const result = await executeTransition(
    taskId,
    {
      expectedFrom: ["awaiting_review"],
      to: "returned",
      rolesAllowed: "reviewer-or-admin",
    },
    { action: "return", reason: parsed.data.reason },
  );
  if (result.ok) {
    const sb = await createClient();
    const {
      data: { user: u },
    } = await sb.auth.getUser();
    const ctx = await loadTaskNotificationContext(sb, taskId);
    if (ctx && u) await notifyTaskReturned(ctx, u.id, parsed.data.reason);
  }
  return result;
}

export async function blockTaskAction(
  taskId: string,
  input: BlockTaskInput,
): Promise<TaskActionResult> {
  const parsed = blockTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("task_comments").insert({
      task_id: taskId,
      author_id: user.id,
      body: `Báo bị chặn: ${parsed.data.reason}`,
      is_internal: true,
    });
  }
  const result = await executeTransition(
    taskId,
    {
      expectedFrom: ["assigned", "in_progress", "returned"],
      to: "blocked",
      rolesAllowed: "assignee",
    },
    { action: "block", reason: parsed.data.reason },
  );
  if (result.ok) {
    const sb = await createClient();
    const {
      data: { user: u },
    } = await sb.auth.getUser();
    const ctx = await loadTaskNotificationContext(sb, taskId);
    if (ctx && u) await notifyTaskBlocked(ctx, u.id, parsed.data.reason);
  }
  return result;
}

export async function unblockTaskAction(
  taskId: string,
): Promise<TaskActionResult> {
  return executeTransition(
    taskId,
    {
      expectedFrom: ["blocked"],
      to: "in_progress",
      rolesAllowed: "assignee",
    },
    { action: "unblock" },
  );
}

export async function awaitingCustomerAction(
  taskId: string,
  input: AwaitingCustomerInput,
): Promise<TaskActionResult> {
  const parsed = awaitingCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Dữ liệu không hợp lệ" };
  }
  if (parsed.data.reason) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("task_comments").insert({
        task_id: taskId,
        author_id: user.id,
        body: `Chờ phản hồi khách: ${parsed.data.reason}`,
        is_internal: false,
      });
    }
  }
  return executeTransition(
    taskId,
    {
      expectedFrom: ["assigned", "in_progress"],
      to: "awaiting_customer",
      rolesAllowed: "assignee",
    },
    { action: "awaiting_customer", reason: parsed.data.reason ?? null },
  );
}

export async function cancelTaskAction(
  taskId: string,
): Promise<TaskActionResult> {
  return executeTransition(
    taskId,
    {
      expectedFrom: [
        "todo",
        "assigned",
        "in_progress",
        "blocked",
        "awaiting_customer",
        "awaiting_review",
        "returned",
      ],
      to: "cancelled",
      rolesAllowed: "any-internal",
    },
    { action: "cancel" },
  );
}

// ---- Checklist ----

export async function upsertTaskChecklistItemAction(
  taskId: string,
  input: UpsertTaskChecklistInput,
): Promise<TaskActionResult<{ id: string }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = upsertTaskChecklistSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const supabase = await createClient();
  if (parsed.data.id) {
    const { error } = await supabase
      .from("task_checklist_items")
      .update({
        content: parsed.data.content,
        sort_order: parsed.data.sort_order,
      })
      .eq("id", parsed.data.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, data: { id: parsed.data.id } };
  }
  const { data, error } = await supabase
    .from("task_checklist_items")
    .insert({
      task_id: taskId,
      content: parsed.data.content,
      sort_order: parsed.data.sort_order,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không tạo được checklist" };
  }
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, data: { id: data.id } };
}

export async function toggleTaskChecklistItemAction(
  taskId: string,
  itemId: string,
  done: boolean,
): Promise<TaskActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };
  const { error } = await supabase
    .from("task_checklist_items")
    .update({
      done,
      done_by: done ? user.id : null,
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function deleteTaskChecklistItemAction(
  taskId: string,
  itemId: string,
): Promise<TaskActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_checklist_items")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

// ---- Comments ----

export async function addTaskCommentAction(
  taskId: string,
  input: AddTaskCommentInput,
): Promise<TaskActionResult<{ id: string }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = addTaskCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_id: user.id,
      body: parsed.data.body,
      is_internal: parsed.data.is_internal,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không gửi được bình luận" };
  }
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, data: { id: data.id } };
}

/**
 * Customer-side comment: gated by audience='customer' + RLS already enforces
 * that the customer can only comment on tasks visible to them. We force
 * is_internal=false on insert.
 */
export async function addCustomerTaskCommentAction(
  taskId: string,
  body: string,
): Promise<TaskActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: "Nội dung không được để trống" };

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_id: user.id,
      body: trimmed,
      is_internal: false,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không gửi được bình luận" };
  }
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, data: { id: data.id } };
}
