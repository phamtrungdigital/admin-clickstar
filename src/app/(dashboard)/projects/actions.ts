"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import { forkTemplateCore } from "@/lib/projects/fork";
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

/**
 * Fork a service template into a real project under a contract.
 * Wraps forkTemplateCore with auth + revalidation; the actual cloning
 * lives in lib/projects/fork.ts so contracts/actions.ts can reuse it
 * for auto-fork-on-create.
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

  const result = await forkTemplateCore(supabase, user.id, {
    contractId: parsed.data.contract_id,
    templateId: parsed.data.template_id,
    name: parsed.data.name,
    startsAt: parsed.data.starts_at,
    pmId: parsed.data.pm_id,
  });
  if (!result.ok) return result;

  revalidatePath("/projects");
  revalidatePath(`/contracts/${parsed.data.contract_id}`);
  return { ok: true, data: { id: result.data.projectId } };
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

/**
 * Set hoặc clear PM của project. Chỉ admin/manager mới có quyền — staff
 * thường không tự gán mình hay người khác làm PM.
 */
export async function setProjectPmAction(
  projectId: string,
  pmId: string | null,
): Promise<ProjectActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const role = guard.profile.internal_role;
  if (
    role !== "super_admin" &&
    role !== "admin" &&
    role !== "manager"
  ) {
    return {
      ok: false,
      message: "Chỉ admin/manager mới gán được PM dự án",
    };
  }

  const supabase = await createClient();
  // Nếu set PM (không phải clear), verify pm_id phải là internal active
  if (pmId) {
    const { data: pm } = await supabase
      .from("profiles")
      .select("id, audience, is_active, deleted_at")
      .eq("id", pmId)
      .maybeSingle();
    if (!pm || pm.audience !== "internal" || !pm.is_active || pm.deleted_at) {
      return {
        ok: false,
        message: "Người được chọn không phải nhân viên nội bộ đang hoạt động",
      };
    }
  }

  const { error } = await supabase
    .from("projects")
    .update({ pm_id: pmId })
    .eq("id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
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
