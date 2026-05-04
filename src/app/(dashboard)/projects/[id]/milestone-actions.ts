"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import type { ProfileRow } from "@/lib/database.types";

function isAdminLevel(profile: ProfileRow | null): boolean {
  if (!profile || profile.audience !== "internal") return false;
  return (
    profile.internal_role === "super_admin" ||
    profile.internal_role === "admin"
  );
}
import {
  addMilestoneCommentSchema,
  completeMilestoneSchema,
  reopenMilestoneSchema,
  updateMilestoneSchema,
  UNDO_WINDOW_MINUTES,
  type AddMilestoneCommentInput,
  type CompleteMilestoneInput,
  type ReopenMilestoneInput,
  type UpdateMilestoneInput,
} from "@/lib/validation/milestones";
import { logAudit } from "@/lib/audit";
import {
  notifyMilestoneCommented,
  notifyMilestoneCompleted,
  notifyMilestoneReopened,
} from "@/lib/notifications/milestones";

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

  // Chặn set status='completed' qua form edit — buộc dùng nút "Đánh dấu
  // hoàn thành" để có evidence (summary + attachments + links). Nếu đã
  // completed sẵn (data cũ) thì cho qua để form không break.
  if (
    parsed.data.status === "completed" &&
    existing.status !== "completed"
  ) {
    return {
      ok: false,
      message:
        "Để hoàn thành công việc, dùng nút 'Đánh dấu hoàn thành' (yêu cầu đính kèm bằng chứng nghiệm thu)",
    };
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
  const adminClient = createAdminClient();

  // Insert comment (RLS check: author_id = auth.uid + access company)
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

  // Load full context cho notify (qua admin client — staff có thể không
  // join nested companies được, cùng lý do trong completeMilestoneAction)
  const { data: ms } = await adminClient
    .from("milestones")
    .select(
      `
      id, title, project_id,
      project:projects!milestones_project_id_fkey (
        id, name, pm_id, company_id,
        company:companies!projects_company_id_fkey (
          id, name, primary_account_manager_id
        )
      )
    `,
    )
    .eq("id", parsed.data.milestone_id)
    .maybeSingle();

  // Notify cho người liên quan (non-fatal)
  if (ms) {
    const project = (ms as unknown as {
      project: {
        id: string;
        name: string;
        pm_id: string | null;
        company_id: string;
        company: {
          id: string;
          name: string;
          primary_account_manager_id: string | null;
        } | null;
      } | null;
    }).project;
    if (project) {
      await notifyMilestoneCommented(
        {
          milestoneId: parsed.data.milestone_id,
          milestoneTitle: ms.title as string,
          projectId: project.id,
          projectName: project.name,
          companyId: project.company_id ?? null,
          companyName: project.company?.name ?? null,
          pmId: project.pm_id,
          accountManagerId: project.company?.primary_account_manager_id ?? null,
          actorId: userId,
          actorName: profile?.full_name || "(không rõ)",
        },
        parsed.data.body,
      ).catch((err) => {
        console.error("[milestone-comment] notify failed", err);
      });
    }
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

// =============================================================================
// Mark milestone as completed với evidence (summary + attachments + links)
// =============================================================================

export async function completeMilestoneAction(
  milestoneId: string,
  input: CompleteMilestoneInput,
): Promise<ActionResult<{ completionId: string }>> {
  const { id: userId, profile } = await getCurrentUser();
  if (!isInternal(profile)) {
    return { ok: false, message: "Không có quyền báo hoàn thành" };
  }

  const parsed = completeMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return { ok: false, message: "Dữ liệu chưa hợp lệ", fieldErrors };
  }

  const supabase = await createClient();
  // Dùng admin client để load context (project + company) — staff thường
  // có RLS access nhưng nested embed đôi khi trả null khi join qua nhiều
  // table với policy khác nhau. Action chỉ dùng admin client để LOOKUP
  // metadata cho notify, không bypass auth — đã check isInternal ở trên.
  const adminClient = createAdminClient();

  // Verify milestone thực sự tồn tại + user có quyền read (qua client thường)
  const { data: msAuth, error: msAuthErr } = await supabase
    .from("milestones")
    .select("id, status")
    .eq("id", milestoneId)
    .maybeSingle();

  if (msAuthErr) {
    console.error("[milestone-complete] auth check failed", msAuthErr);
    return { ok: false, message: msAuthErr.message };
  }
  if (!msAuth) {
    return { ok: false, message: "Không tìm thấy milestone hoặc bạn không có quyền" };
  }
  if (msAuth.status === "completed") {
    return { ok: false, message: "Milestone đã ở trạng thái hoàn thành" };
  }

  // Lấy full context qua admin client (bỏ qua RLS — chỉ đọc metadata)
  const { data: ms, error: msErr } = await adminClient
    .from("milestones")
    .select(
      `
      id, title, status, project_id,
      project:projects!milestones_project_id_fkey (
        id, name, pm_id, company_id,
        company:companies!projects_company_id_fkey (
          id, name, primary_account_manager_id
        )
      )
    `,
    )
    .eq("id", milestoneId)
    .maybeSingle();
  if (msErr || !ms) {
    console.error("[milestone-complete] context load failed", msErr);
    return { ok: false, message: "Không load được context milestone" };
  }

  // Insert completion row (RLS check: completed_by = auth.uid + access company)
  const { data: completion, error: insErr } = await supabase
    .from("milestone_completions")
    .insert({
      milestone_id: milestoneId,
      completed_by: userId,
      summary: parsed.data.summary,
      attachments: parsed.data.attachments,
      links: parsed.data.links,
    })
    .select("id, completed_at")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return {
        ok: false,
        message: "Milestone này đã có completion đang hoạt động",
      };
    }
    return { ok: false, message: insErr.message };
  }

  // Update milestone status
  const { error: updErr } = await supabase
    .from("milestones")
    .update({ status: "completed", progress_percent: 100 })
    .eq("id", milestoneId);

  if (updErr) {
    // Rollback completion row nếu update fail (best effort)
    await supabase
      .from("milestone_completions")
      .delete()
      .eq("id", completion.id);
    return { ok: false, message: updErr.message };
  }

  // Audit log
  const project = (ms as unknown as {
    project: {
      id: string;
      name: string;
      pm_id: string | null;
      company_id: string;
      company: {
        id: string;
        name: string;
        primary_account_manager_id: string | null;
      } | null;
    } | null;
  }).project;

  await logAudit({
    user_id: userId,
    company_id: project?.company_id ?? null,
    action: "create",
    entity_type: "milestone",
    entity_id: milestoneId,
    new_value: {
      action: "completed",
      summary: parsed.data.summary,
      attachments_count: parsed.data.attachments.length,
      links_count: parsed.data.links.length,
    },
  });

  // Notify PM + AM + admin (in-app + email). Non-fatal.
  if (project) {
    await notifyMilestoneCompleted(
      {
        milestoneId,
        milestoneTitle: ms.title as string,
        projectId: project.id,
        projectName: project.name,
        companyId: project.company_id ?? null,
        companyName: project.company?.name ?? null,
        pmId: project.pm_id,
        accountManagerId:
          project.company?.primary_account_manager_id ?? null,
        actorId: userId,
        actorName: profile?.full_name || "(không rõ)",
      },
      {
        summary: parsed.data.summary,
        attachmentsCount: parsed.data.attachments.length,
        linksCount: parsed.data.links.length,
      },
    ).catch((err) => {
      console.error("[milestone-complete] notify failed", err);
    });
  }

  revalidatePath(`/projects/${ms.project_id}`);
  return { ok: true, data: { completionId: completion.id } };
}

/**
 * Hoàn tác trong vòng UNDO_WINDOW_MINUTES — chỉ tác giả mới được làm.
 * Set undone_at trên completion → unique partial index nhả chỗ → milestone
 * có thể được mark complete lại sau. Reset milestone về status active.
 */
export async function undoMilestoneCompletionAction(
  completionId: string,
): Promise<ActionResult> {
  const { id: userId, profile } = await getCurrentUser();
  if (!isInternal(profile)) {
    return { ok: false, message: "Không có quyền" };
  }

  const supabase = await createClient();
  const { data: completion, error: getErr } = await supabase
    .from("milestone_completions")
    .select("id, milestone_id, completed_by, completed_at, undone_at")
    .eq("id", completionId)
    .maybeSingle();
  if (getErr || !completion) {
    return { ok: false, message: "Không tìm thấy completion" };
  }
  if (completion.undone_at) {
    return { ok: false, message: "Đã hoàn tác trước đó" };
  }
  if (completion.completed_by !== userId) {
    return { ok: false, message: "Chỉ người báo hoàn thành mới hoàn tác được" };
  }
  const completedAt = new Date(completion.completed_at as string);
  const elapsedMin = (Date.now() - completedAt.getTime()) / 60_000;
  if (elapsedMin > UNDO_WINDOW_MINUTES) {
    return {
      ok: false,
      message: `Quá ${UNDO_WINDOW_MINUTES} phút để hoàn tác — vui lòng nhờ admin mở lại`,
    };
  }

  const { error: undoErr } = await supabase
    .from("milestone_completions")
    .update({ undone_at: new Date().toISOString(), undone_by: userId })
    .eq("id", completionId);
  if (undoErr) return { ok: false, message: undoErr.message };

  // Revert milestone về active + giữ progress 100% để user thấy là vừa
  // hoàn tác xong (họ tự kéo về sau nếu cần).
  const { error: revErr, data: ms } = await supabase
    .from("milestones")
    .update({ status: "active" })
    .eq("id", completion.milestone_id)
    .select("project_id")
    .single();
  if (revErr) return { ok: false, message: revErr.message };

  await logAudit({
    user_id: userId,
    action: "update",
    entity_type: "milestone",
    entity_id: completion.milestone_id as string,
    new_value: { action: "undone_completion" },
  });

  revalidatePath(`/projects/${ms.project_id}`);
  return { ok: true };
}

/**
 * Admin / super_admin mở lại 1 milestone đã hoàn thành. Bắt buộc nhập lý do.
 * Notify lại cho người báo xong ban đầu.
 */
export async function reopenMilestoneAction(
  milestoneId: string,
  input: ReopenMilestoneInput,
): Promise<ActionResult> {
  const { id: userId, profile } = await getCurrentUser();
  if (!isAdminLevel(profile)) {
    return { ok: false, message: "Chỉ admin mới mở lại được milestone" };
  }

  const parsed = reopenMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Lý do chưa hợp lệ" };
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Tìm completion active hiện tại của milestone này
  const { data: completion } = await supabase
    .from("milestone_completions")
    .select("id, completed_by")
    .eq("milestone_id", milestoneId)
    .is("undone_at", null)
    .is("reopened_at", null)
    .maybeSingle();

  if (!completion) {
    return { ok: false, message: "Milestone chưa có completion để mở lại" };
  }

  // Mark completion = reopened
  const { error: rErr } = await supabase
    .from("milestone_completions")
    .update({
      reopened_at: new Date().toISOString(),
      reopened_by: userId,
      reopen_reason: parsed.data.reason,
    })
    .eq("id", completion.id);
  if (rErr) return { ok: false, message: rErr.message };

  // Revert milestone về active (qua user client để giữ audit chain)
  const { error: revErr } = await supabase
    .from("milestones")
    .update({ status: "active" })
    .eq("id", milestoneId);
  if (revErr) return { ok: false, message: revErr.message };

  // Lấy full context qua admin client cho notify (cùng lý do trong
  // completeMilestoneAction — embed nested có thể trả null với RLS staff).
  const { data: ms, error: msErr } = await adminClient
    .from("milestones")
    .select(
      `
      id, title, project_id,
      project:projects!milestones_project_id_fkey (
        id, name, pm_id, company_id,
        company:companies!projects_company_id_fkey (
          id, name, primary_account_manager_id
        )
      )
    `,
    )
    .eq("id", milestoneId)
    .single();
  if (msErr || !ms) {
    console.error("[milestone-reopen] context load failed", msErr);
    // Vẫn return OK vì revert đã thành công, chỉ skip notify
    revalidatePath(`/projects/${milestoneId}`);
    return { ok: true };
  }

  await logAudit({
    user_id: userId,
    action: "update",
    entity_type: "milestone",
    entity_id: milestoneId,
    new_value: { action: "reopened", reason: parsed.data.reason },
  });

  // Notify người báo xong ban đầu
  const project = (ms as unknown as {
    project: {
      id: string;
      name: string;
      pm_id: string | null;
      company_id: string;
      company: {
        id: string;
        name: string;
        primary_account_manager_id: string | null;
      } | null;
    } | null;
  }).project;
  if (project) {
    await notifyMilestoneReopened(
      {
        milestoneId,
        milestoneTitle: ms.title as string,
        projectId: project.id,
        projectName: project.name,
        companyId: project.company_id ?? null,
        companyName: project.company?.name ?? null,
        pmId: project.pm_id,
        accountManagerId:
          project.company?.primary_account_manager_id ?? null,
        actorId: userId,
        actorName: profile?.full_name || "(không rõ)",
        originalCompleterId: completion.completed_by as string,
      },
      parsed.data.reason,
    ).catch((err) => {
      console.error("[milestone-reopen] notify failed", err);
    });
  }

  revalidatePath(`/projects/${ms.project_id}`);
  return { ok: true };
}

