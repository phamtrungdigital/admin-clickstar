"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  forkProjectSchema,
  updateProjectSchema,
  type ForkProjectInput,
  type UpdateProjectInput,
} from "@/lib/validation/projects";

export type ProjectActionResult<T = void> =
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

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fork a service template into a real project under a contract.
 *
 * Clones template → project, then template_milestones → milestones (with
 * concrete starts_at/ends_at), then template_tasks → tasks (with concrete
 * due_at), then template_checklist_items → task_checklist_items. The
 * project records `template_id` and `template_version` so we can audit the
 * fork later, but it does NOT keep a live reference (PRD §5.3 — fork is
 * independent, template updates don't propagate).
 */
export async function forkTemplateAction(
  input: ForkProjectInput,
): Promise<ProjectActionResult<{ id: string }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = forkProjectSchema.safeParse(input);
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

  // Load contract (to inherit company_id) and template (with children).
  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("id, company_id")
    .eq("id", parsed.data.contract_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (cErr) return { ok: false, message: cErr.message };
  if (!contract) return { ok: false, message: "Hợp đồng không tồn tại" };

  const { data: template, error: tErr } = await supabase
    .from("service_templates")
    .select("id, version, duration_days")
    .eq("id", parsed.data.template_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (tErr) return { ok: false, message: tErr.message };
  if (!template) return { ok: false, message: "Template không tồn tại" };

  const { data: tplMilestones, error: msErr } = await supabase
    .from("template_milestones")
    .select("*")
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });
  if (msErr) return { ok: false, message: msErr.message };

  const { data: tplTasks, error: ttErr } = await supabase
    .from("template_tasks")
    .select("*")
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });
  if (ttErr) return { ok: false, message: ttErr.message };

  const tplTaskIds = (tplTasks ?? []).map((t) => t.id);
  let tplChecklists: Array<{
    id: string;
    template_task_id: string;
    content: string;
    sort_order: number;
  }> = [];
  if (tplTaskIds.length > 0) {
    const { data: cl, error: clErr } = await supabase
      .from("template_checklist_items")
      .select("*")
      .in("template_task_id", tplTaskIds)
      .order("sort_order", { ascending: true });
    if (clErr) return { ok: false, message: clErr.message };
    tplChecklists = cl ?? [];
  }

  const startsAt = parsed.data.starts_at;
  const endsAt = addDays(
    startsAt,
    template.duration_days ?? 30,
  );

  // 1) Create project
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .insert({
      company_id: contract.company_id,
      contract_id: contract.id,
      template_id: template.id,
      template_version: template.version,
      pm_id: parsed.data.pm_id,
      name: parsed.data.name,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "not_started",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (pErr || !project) {
    return { ok: false, message: pErr?.message ?? "Không tạo được dự án" };
  }

  // 2) Clone milestones, build template_milestone_id → new milestone_id map
  const milestoneMap = new Map<string, string>();
  if (tplMilestones && tplMilestones.length > 0) {
    const milestoneRows = tplMilestones.map((m) => ({
      project_id: project.id,
      template_milestone_id: m.id,
      code: m.code,
      title: m.title,
      description: m.description,
      sort_order: m.sort_order,
      starts_at: addDays(startsAt, m.offset_start_days),
      ends_at: addDays(startsAt, m.offset_end_days),
      deliverable_required: m.deliverable_required,
      status: "not_started" as const,
    }));
    const { data: insertedMs, error: imErr } = await supabase
      .from("milestones")
      .insert(milestoneRows)
      .select("id, template_milestone_id");
    if (imErr) return { ok: false, message: imErr.message };
    for (const m of insertedMs ?? []) {
      if (m.template_milestone_id) {
        milestoneMap.set(m.template_milestone_id as string, m.id as string);
      }
    }
  }

  // 3) Clone tasks
  const tplTaskToTaskId = new Map<string, string>();
  if (tplTasks && tplTasks.length > 0) {
    const taskRows = tplTasks.map((t) => {
      const dueIso = addDays(
        startsAt,
        (t.offset_days as number) + (t.duration_days as number),
      );
      return {
        company_id: contract.company_id,
        project_id: project.id,
        milestone_id: t.template_milestone_id
          ? milestoneMap.get(t.template_milestone_id as string) ?? null
          : null,
        template_task_id: t.id,
        title: t.title,
        description: t.description,
        due_at: new Date(dueIso).toISOString(),
        status: "todo" as const,
        priority: t.priority,
        is_visible_to_customer: t.is_visible_to_customer,
        is_extra: false,
        created_by: user.id,
      };
    });
    const { data: insertedTasks, error: itErr } = await supabase
      .from("tasks")
      .insert(taskRows)
      .select("id, template_task_id");
    if (itErr) return { ok: false, message: itErr.message };
    for (const t of insertedTasks ?? []) {
      if (t.template_task_id) {
        tplTaskToTaskId.set(t.template_task_id as string, t.id as string);
      }
    }
  }

  // 4) Clone checklist items
  if (tplChecklists.length > 0 && tplTaskToTaskId.size > 0) {
    const checklistRows = tplChecklists
      .map((c) => {
        const taskId = tplTaskToTaskId.get(c.template_task_id);
        if (!taskId) return null;
        return {
          task_id: taskId,
          content: c.content,
          sort_order: c.sort_order,
          done: false,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (checklistRows.length > 0) {
      const { error: icErr } = await supabase
        .from("task_checklist_items")
        .insert(checklistRows);
      if (icErr) return { ok: false, message: icErr.message };
    }
  }

  await logAudit({
    user_id: user.id,
    company_id: contract.company_id,
    action: "create",
    entity_type: "service",
    entity_id: project.id,
    new_value: {
      template_id: template.id,
      template_version: template.version,
      milestone_count: tplMilestones?.length ?? 0,
      task_count: tplTasks?.length ?? 0,
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/contracts/${contract.id}`);
  return { ok: true, data: { id: project.id } };
}

export async function updateProjectAction(
  id: string,
  input: UpdateProjectInput,
): Promise<ProjectActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const supabase = await createClient();
  const payload: Record<string, unknown> = { ...parsed.data };
  for (const k of ["description", "starts_at", "ends_at"] as const) {
    if (k in payload) {
      const v = payload[k];
      payload[k] = typeof v === "string" && v.length > 0 ? v : null;
    }
  }
  const { error } = await supabase.from("projects").update(payload).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function softDeleteProjectAction(
  id: string,
): Promise<ProjectActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/projects");
  return { ok: true };
}
