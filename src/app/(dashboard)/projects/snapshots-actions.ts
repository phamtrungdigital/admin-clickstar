"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { buildSnapshotPayload } from "@/lib/queries/snapshots";
import {
  notifySnapshotApproved,
  notifySnapshotCreated,
  notifySnapshotRejected,
  notifySnapshotRolledBack,
} from "@/lib/notifications/snapshots";
import {
  approveSnapshotSchema,
  createSnapshotSchema,
  rejectSnapshotSchema,
  rollbackSnapshotSchema,
  type ApproveSnapshotInput,
  type CreateSnapshotInput,
  type RejectSnapshotInput,
  type RollbackSnapshotInput,
} from "@/lib/validation/snapshots";

export type SnapshotActionResult<T = void> =
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
 * Create a snapshot of the current customer-visible state of a project.
 * Status starts at 'pending_approval'. For type='weekly' we set
 * auto_publish_at = now + 24h so pg_cron auto-publishes if no admin
 * decides in time. For other types (milestone/deliverable/extra_task)
 * auto_publish_at is NULL — admin must approve manually (PRD §7.2).
 */
export async function createSnapshotAction(
  input: CreateSnapshotInput,
): Promise<SnapshotActionResult<{ id: string }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = createSnapshotSchema.safeParse(input);
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

  // Pull project + ensure caller can see it (RLS will also enforce on insert).
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("id, name, contract_id, company_id")
    .eq("id", parsed.data.project_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (pErr) return { ok: false, message: pErr.message };
  if (!project) return { ok: false, message: "Dự án không tồn tại" };
  if (!project.contract_id) {
    return { ok: false, message: "Dự án chưa gắn vào hợp đồng nào" };
  }

  const payload = await buildSnapshotPayload(parsed.data.project_id);
  if (!payload) return { ok: false, message: "Không tải được dữ liệu dự án" };

  const autoPublishAt =
    parsed.data.type === "weekly"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { data: snapshot, error } = await supabase
    .from("snapshots")
    .insert({
      project_id: parsed.data.project_id,
      contract_id: project.contract_id as string,
      type: parsed.data.type,
      status: "pending_approval",
      payload: payload as unknown as Record<string, unknown>,
      notes: parsed.data.notes || null,
      auto_publish_at: autoPublishAt,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !snapshot) {
    return { ok: false, message: error?.message ?? "Không tạo được snapshot" };
  }

  await logAudit({
    user_id: user.id,
    company_id: project.company_id as string,
    action: "create",
    entity_type: "service",
    entity_id: snapshot.id,
    new_value: {
      kind: "snapshot",
      type: parsed.data.type,
      auto_publish_at: autoPublishAt,
      milestone_count: payload.milestones.length,
      visible_task_count: payload.tasks.length,
    },
  });

  await notifySnapshotCreated(
    {
      snapshotId: snapshot.id,
      projectId: parsed.data.project_id,
      projectName: project.name as string,
      companyId: project.company_id as string,
      createdBy: user.id,
    },
    parsed.data.type,
  );

  revalidatePath(`/projects/${parsed.data.project_id}`);
  return { ok: true, data: { id: snapshot.id } };
}

async function loadSnapshotContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  snapshotId: string,
): Promise<{
  snapshotId: string;
  projectId: string;
  projectName: string;
  companyId: string;
  createdBy: string;
} | null> {
  const { data, error } = await supabase
    .from("snapshots")
    .select(
      "id, project_id, created_by, project:projects!snapshots_project_id_fkey ( id, name, company_id )",
    )
    .eq("id", snapshotId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as {
    id: string;
    project_id: string;
    created_by: string;
    project: { id: string; name: string; company_id: string } | null;
  };
  if (!r.project) return null;
  return {
    snapshotId: r.id,
    projectId: r.project_id,
    projectName: r.project.name,
    companyId: r.project.company_id,
    createdBy: r.created_by,
  };
}

export async function approveSnapshotAction(
  snapshotId: string,
  input: ApproveSnapshotInput,
): Promise<SnapshotActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  if (
    guard.profile.internal_role !== "super_admin" &&
    guard.profile.internal_role !== "admin"
  ) {
    return { ok: false, message: "Chỉ quản trị viên mới duyệt được snapshot." };
  }
  const parsed = approveSnapshotSchema.safeParse(input);
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

  const nowIso = new Date().toISOString();
  const rollbackUntil = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const updates: Record<string, unknown> = {
    status: "approved",
    approved_by: user.id,
    approved_at: nowIso,
    rollback_until: rollbackUntil,
  };
  if (parsed.data.comment) updates.notes = parsed.data.comment;

  const { data: row, error } = await supabase
    .from("snapshots")
    .update(updates)
    .eq("id", snapshotId)
    .eq("status", "pending_approval")
    .select("project_id, contract_id, type")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) {
    return {
      ok: false,
      message:
        "Snapshot không ở trạng thái chờ duyệt — có thể đã được duyệt/từ chối/auto-publish.",
    };
  }

  await logAudit({
    user_id: user.id,
    action: "update",
    entity_type: "service",
    entity_id: snapshotId,
    new_value: { kind: "snapshot", action: "approved", type: row.type },
  });

  const ctx = await loadSnapshotContext(supabase, snapshotId);
  if (ctx) await notifySnapshotApproved(ctx);

  revalidatePath(`/projects/${row.project_id as string}`);
  return { ok: true };
}

export async function rejectSnapshotAction(
  snapshotId: string,
  input: RejectSnapshotInput,
): Promise<SnapshotActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  if (
    guard.profile.internal_role !== "super_admin" &&
    guard.profile.internal_role !== "admin"
  ) {
    return { ok: false, message: "Chỉ quản trị viên mới từ chối được snapshot." };
  }
  const parsed = rejectSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Vui lòng nhập lý do từ chối",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { data: row, error } = await supabase
    .from("snapshots")
    .update({
      status: "rejected",
      rejected_reason: parsed.data.reason,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", snapshotId)
    .eq("status", "pending_approval")
    .select("project_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) {
    return {
      ok: false,
      message: "Snapshot không ở trạng thái chờ duyệt.",
    };
  }

  await logAudit({
    user_id: user.id,
    action: "update",
    entity_type: "service",
    entity_id: snapshotId,
    new_value: { kind: "snapshot", action: "rejected", reason: parsed.data.reason },
  });

  const ctx = await loadSnapshotContext(supabase, snapshotId);
  if (ctx) await notifySnapshotRejected(ctx, parsed.data.reason);

  revalidatePath(`/projects/${row.project_id as string}`);
  return { ok: true };
}

export async function rollbackSnapshotAction(
  snapshotId: string,
  input: RollbackSnapshotInput,
): Promise<SnapshotActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  if (
    guard.profile.internal_role !== "super_admin" &&
    guard.profile.internal_role !== "admin"
  ) {
    return { ok: false, message: "Chỉ quản trị viên mới rollback được snapshot." };
  }
  const parsed = rollbackSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Vui lòng nhập lý do rollback",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  // Only allow rollback within rollback_until (7 days), and only for
  // approved / auto_published snapshots.
  const { data: existing, error: lookupErr } = await supabase
    .from("snapshots")
    .select("id, status, rollback_until, project_id")
    .eq("id", snapshotId)
    .maybeSingle();
  if (lookupErr) return { ok: false, message: lookupErr.message };
  if (!existing) return { ok: false, message: "Snapshot không tồn tại" };

  if (
    existing.status !== "approved" &&
    existing.status !== "auto_published"
  ) {
    return {
      ok: false,
      message: "Chỉ rollback được snapshot đã publish.",
    };
  }
  if (
    existing.rollback_until &&
    new Date(existing.rollback_until as string) < new Date()
  ) {
    return {
      ok: false,
      message: "Đã quá hạn rollback (7 ngày sau khi publish).",
    };
  }

  const { error } = await supabase
    .from("snapshots")
    .update({
      status: "rolled_back",
      rejected_reason: parsed.data.reason,
    })
    .eq("id", snapshotId);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user.id,
    action: "update",
    entity_type: "service",
    entity_id: snapshotId,
    new_value: {
      kind: "snapshot",
      action: "rolled_back",
      reason: parsed.data.reason,
    },
  });

  const ctx = await loadSnapshotContext(supabase, snapshotId);
  if (ctx) await notifySnapshotRolledBack(ctx, parsed.data.reason);

  revalidatePath(`/projects/${existing.project_id as string}`);
  return { ok: true };
}
