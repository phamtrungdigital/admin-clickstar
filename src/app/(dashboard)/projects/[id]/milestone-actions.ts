"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import {
  addMilestoneCommentSchema,
  updateMilestoneSchema,
  type AddMilestoneCommentInput,
  type UpdateMilestoneInput,
} from "@/lib/validation/milestones";
import { logAudit } from "@/lib/audit";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Cập nhật milestone (title/description/status/dates/progress).
 * RLS milestones_modify_internal cho phép tất cả internal staff có
 * access company của project — staff được giao đều edit được.
 */
export async function updateMilestoneAction(
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<ActionResult> {
  const { id: userId, profile } = await getCurrentUser();
  if (!isInternal(profile)) {
    return { ok: false, message: "Không có quyền chỉnh milestone" };
  }

  const parsed = updateMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return { ok: false, message: "Dữ liệu không hợp lệ", fieldErrors };
  }

  const supabase = await createClient();

  // Lấy project_id để revalidate đúng path + log audit
  const { data: existing, error: getErr } = await supabase
    .from("milestones")
    .select("id, project_id, title, status, progress_percent")
    .eq("id", milestoneId)
    .maybeSingle();
  if (getErr || !existing) {
    return { ok: false, message: "Không tìm thấy milestone" };
  }

  const { error } = await supabase
    .from("milestones")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      progress_percent: parsed.data.progress_percent,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
    })
    .eq("id", milestoneId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await logAudit({
    user_id: userId,
    action: "update",
    entity_type: "milestone",
    entity_id: milestoneId,
    old_value: existing,
    new_value: parsed.data,
  });

  revalidatePath(`/projects/${existing.project_id}`);
  return { ok: true };
}

export async function addMilestoneCommentAction(
  input: AddMilestoneCommentInput,
): Promise<ActionResult<{ id: string }>> {
  const { id: userId, profile } = await getCurrentUser();
  if (!isInternal(profile)) {
    return { ok: false, message: "Không có quyền bình luận" };
  }

  const parsed = addMilestoneCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Nội dung không hợp lệ" };
  }

  const supabase = await createClient();

  // Lookup project_id để revalidate
  const { data: ms } = await supabase
    .from("milestones")
    .select("project_id")
    .eq("id", parsed.data.milestone_id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("milestone_comments")
    .insert({
      milestone_id: parsed.data.milestone_id,
      author_id: userId,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  if (ms?.project_id) {
    revalidatePath(`/projects/${ms.project_id}`);
  }
  return { ok: true, data: { id: data.id } };
}

export async function deleteMilestoneCommentAction(
  commentId: string,
): Promise<ActionResult> {
  const { profile } = await getCurrentUser();
  if (!isInternal(profile)) {
    return { ok: false, message: "Không có quyền xoá" };
  }

  const supabase = await createClient();

  // Lookup project_id (qua milestone) để revalidate
  const { data: c } = await supabase
    .from("milestone_comments")
    .select("milestone_id")
    .eq("id", commentId)
    .maybeSingle();

  // Soft delete để giữ history
  const { error } = await supabase
    .from("milestone_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (c?.milestone_id) {
    const { data: ms } = await supabase
      .from("milestones")
      .select("project_id")
      .eq("id", c.milestone_id)
      .maybeSingle();
    if (ms?.project_id) revalidatePath(`/projects/${ms.project_id}`);
  }
  return { ok: true };
}
