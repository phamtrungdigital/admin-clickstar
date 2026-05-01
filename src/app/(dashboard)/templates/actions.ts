"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  createTemplateSchema,
  normalizeTemplateInput,
  updateTemplateSchema,
  upsertChecklistItemSchema,
  upsertMilestoneSchema,
  upsertTemplateTaskSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type UpsertChecklistItemInput,
  type UpsertMilestoneInput,
  type UpsertTemplateTaskInput,
} from "@/lib/validation/templates";

export type TemplateActionResult<T = void> =
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

async function requireAdmin(): Promise<TemplateActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  // Templates are admin-only per RLS — but we surface a friendly message
  // before the DB rejects.
  if (
    guard.profile.audience !== "internal" ||
    !guard.profile.internal_role ||
    !["super_admin", "admin"].includes(guard.profile.internal_role)
  ) {
    return {
      ok: false,
      message: "Chỉ quản trị viên mới chỉnh sửa được template.",
    };
  }
  return { ok: true };
}

export async function createTemplateAction(
  input: CreateTemplateInput,
): Promise<TemplateActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const parsed = createTemplateSchema.safeParse(input);
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

  const payload = normalizeTemplateInput(parsed.data);

  const { data, error } = await supabase
    .from("service_templates")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không tạo được template" };
  }

  await logAudit({
    user_id: user.id,
    action: "create",
    entity_type: "service",
    entity_id: data.id,
    new_value: { name: payload.name, industry: payload.industry ?? null },
  });

  revalidatePath("/templates");
  return { ok: true, data: { id: data.id } };
}

export async function updateTemplateAction(
  id: string,
  input: UpdateTemplateInput,
): Promise<TemplateActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const payload = normalizeTemplateInput(parsed.data);

  const { error } = await supabase
    .from("service_templates")
    .update(payload)
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  return { ok: true };
}

export async function softDeleteTemplateAction(
  id: string,
): Promise<TemplateActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/templates");
  return { ok: true };
}

export async function bumpTemplateVersionAction(
  id: string,
): Promise<TemplateActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("service_templates")
    .select("version")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, message: "Template không tồn tại" };
  const { error } = await supabase
    .from("service_templates")
    .update({ version: (current.version as number) + 1 })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/templates/${id}`);
  return { ok: true };
}

// ---- Milestones ----

export async function upsertMilestoneAction(
  templateId: string,
  input: UpsertMilestoneInput,
): Promise<TemplateActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const parsed = upsertMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const supabase = await createClient();
  const payload = {
    template_id: templateId,
    code: parsed.data.code || null,
    title: parsed.data.title,
    description: parsed.data.description || null,
    sort_order: parsed.data.sort_order,
    offset_start_days: parsed.data.offset_start_days,
    offset_end_days: parsed.data.offset_end_days,
    deliverable_required: parsed.data.deliverable_required,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("template_milestones")
      .update(payload)
      .eq("id", parsed.data.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/templates/${templateId}`);
    return { ok: true, data: { id: parsed.data.id } };
  }

  const { data, error } = await supabase
    .from("template_milestones")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không tạo được milestone" };
  }
  revalidatePath(`/templates/${templateId}`);
  return { ok: true, data: { id: data.id } };
}

export async function deleteMilestoneAction(
  templateId: string,
  milestoneId: string,
): Promise<TemplateActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase
    .from("template_milestones")
    .delete()
    .eq("id", milestoneId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/templates/${templateId}`);
  return { ok: true };
}

// ---- Template tasks ----

export async function upsertTemplateTaskAction(
  templateId: string,
  input: UpsertTemplateTaskInput,
): Promise<TemplateActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const parsed = upsertTemplateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const supabase = await createClient();
  const payload = {
    template_id: templateId,
    template_milestone_id: parsed.data.template_milestone_id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    sort_order: parsed.data.sort_order,
    default_role: parsed.data.default_role || null,
    offset_days: parsed.data.offset_days,
    duration_days: parsed.data.duration_days,
    priority: parsed.data.priority,
    is_visible_to_customer: parsed.data.is_visible_to_customer,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("template_tasks")
      .update(payload)
      .eq("id", parsed.data.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/templates/${templateId}`);
    return { ok: true, data: { id: parsed.data.id } };
  }
  const { data, error } = await supabase
    .from("template_tasks")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không tạo được task" };
  }
  revalidatePath(`/templates/${templateId}`);
  return { ok: true, data: { id: data.id } };
}

export async function deleteTemplateTaskAction(
  templateId: string,
  taskId: string,
): Promise<TemplateActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase
    .from("template_tasks")
    .delete()
    .eq("id", taskId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/templates/${templateId}`);
  return { ok: true };
}

// ---- Template checklist ----

export async function upsertChecklistItemAction(
  templateId: string,
  templateTaskId: string,
  input: UpsertChecklistItemInput,
): Promise<TemplateActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const parsed = upsertChecklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const supabase = await createClient();
  const payload = {
    template_task_id: templateTaskId,
    content: parsed.data.content,
    sort_order: parsed.data.sort_order,
  };
  if (parsed.data.id) {
    const { error } = await supabase
      .from("template_checklist_items")
      .update(payload)
      .eq("id", parsed.data.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/templates/${templateId}`);
    return { ok: true, data: { id: parsed.data.id } };
  }
  const { data, error } = await supabase
    .from("template_checklist_items")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Không tạo được checklist item",
    };
  }
  revalidatePath(`/templates/${templateId}`);
  return { ok: true, data: { id: data.id } };
}

export async function deleteChecklistItemAction(
  templateId: string,
  itemId: string,
): Promise<TemplateActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase
    .from("template_checklist_items")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/templates/${templateId}`);
  return { ok: true };
}

export async function createTemplateAndRedirect(
  input: CreateTemplateInput,
): Promise<TemplateActionResult> {
  const result = await createTemplateAction(input);
  if (!result.ok) return result;
  redirect(`/templates/${result.data!.id}`);
}
