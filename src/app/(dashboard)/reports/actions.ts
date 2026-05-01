"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  approveReportSchema,
  rejectReportSchema,
  upsertReportSchema,
  type ApproveReportInput,
  type RejectReportInput,
  type UpsertReportInput,
} from "@/lib/validation/reports";

export type ReportActionResult<T = void> =
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

export async function createReportAction(
  input: UpsertReportInput,
): Promise<ReportActionResult<{ id: string }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = upsertReportSchema.safeParse(input);
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

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("id, contract_id, company_id, name")
    .eq("id", parsed.data.project_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (pErr) return { ok: false, message: pErr.message };
  if (!project) return { ok: false, message: "Dự án không tồn tại" };

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      company_id: project.company_id,
      contract_id: project.contract_id,
      project_id: parsed.data.project_id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      content: parsed.data.content,
      period_start: parsed.data.period_start || null,
      period_end: parsed.data.period_end || null,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !report) {
    return { ok: false, message: error?.message ?? "Không tạo được báo cáo" };
  }

  revalidatePath("/reports");
  return { ok: true, data: { id: report.id } };
}

export async function updateReportAction(
  id: string,
  input: UpsertReportInput,
): Promise<ReportActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = upsertReportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  // Only allow editing when the report is in draft / rejected (PM is fixing it).
  const { data: existing } = await supabase
    .from("reports")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, message: "Báo cáo không tồn tại" };
  if (existing.status !== "draft" && existing.status !== "rejected") {
    return {
      ok: false,
      message: "Chỉ chỉnh sửa được khi báo cáo đang ở trạng thái Nháp hoặc Đã từ chối.",
    };
  }

  const { error } = await supabase
    .from("reports")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      content: parsed.data.content,
      period_start: parsed.data.period_start || null,
      period_end: parsed.data.period_end || null,
      // If admin returns a report, edits should bring it back to draft so
      // the lifecycle resumes from the start.
      status: "draft",
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
  return { ok: true };
}

export async function submitReportAction(
  id: string,
): Promise<ReportActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { data: row, error } = await supabase
    .from("reports")
    .update({ status: "pending_approval" })
    .eq("id", id)
    .in("status", ["draft", "rejected"])
    .select("id, project_id, company_id, title")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) {
    return {
      ok: false,
      message: "Báo cáo không ở trạng thái có thể submit (draft / rejected).",
    };
  }

  await logAudit({
    user_id: user.id,
    company_id: row.company_id as string,
    action: "update",
    entity_type: "service",
    entity_id: id,
    new_value: { kind: "report", action: "submitted" },
  });

  await notifyReportEvent(row.company_id as string, "submitted", {
    title: row.title as string,
    reportId: id,
    projectId: row.project_id as string,
    creatorId: user.id,
  });

  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
  return { ok: true };
}

export async function approveReportAction(
  id: string,
  input: ApproveReportInput,
): Promise<ReportActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  if (
    guard.profile.internal_role !== "super_admin" &&
    guard.profile.internal_role !== "admin"
  ) {
    return { ok: false, message: "Chỉ admin mới duyệt được báo cáo." };
  }
  const parsed = approveReportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Dữ liệu không hợp lệ" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const updates: Record<string, unknown> = {
    status: "approved",
    is_published: true,
    published_at: new Date().toISOString(),
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  };
  if (parsed.data.comment) updates.description = parsed.data.comment;

  const { data: row, error } = await supabase
    .from("reports")
    .update(updates)
    .eq("id", id)
    .eq("status", "pending_approval")
    .select("id, project_id, company_id, title, created_by")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) {
    return { ok: false, message: "Báo cáo không ở trạng thái Chờ duyệt." };
  }

  await logAudit({
    user_id: user.id,
    company_id: row.company_id as string,
    action: "update",
    entity_type: "service",
    entity_id: id,
    new_value: { kind: "report", action: "approved" },
  });

  await notifyReportEvent(row.company_id as string, "approved", {
    title: row.title as string,
    reportId: id,
    projectId: row.project_id as string,
    creatorId: row.created_by as string | null,
  });

  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
  return { ok: true };
}

export async function rejectReportAction(
  id: string,
  input: RejectReportInput,
): Promise<ReportActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  if (
    guard.profile.internal_role !== "super_admin" &&
    guard.profile.internal_role !== "admin"
  ) {
    return { ok: false, message: "Chỉ admin mới từ chối được báo cáo." };
  }
  const parsed = rejectReportSchema.safeParse(input);
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
    .from("reports")
    .update({
      status: "rejected",
      rejected_reason: parsed.data.reason,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending_approval")
    .select("id, project_id, company_id, title, created_by")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) {
    return { ok: false, message: "Báo cáo không ở trạng thái Chờ duyệt." };
  }

  await logAudit({
    user_id: user.id,
    company_id: row.company_id as string,
    action: "update",
    entity_type: "service",
    entity_id: id,
    new_value: { kind: "report", action: "rejected", reason: parsed.data.reason },
  });

  await notifyReportEvent(row.company_id as string, "rejected", {
    title: row.title as string,
    reportId: id,
    projectId: row.project_id as string,
    creatorId: row.created_by as string | null,
    reason: parsed.data.reason,
  });

  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
  return { ok: true };
}

export async function softDeleteReportAction(
  id: string,
): Promise<ReportActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/reports");
  return { ok: true };
}

export async function createReportAndRedirect(
  input: UpsertReportInput,
): Promise<ReportActionResult> {
  const result = await createReportAction(input);
  if (!result.ok) return result;
  redirect(`/reports/${result.data!.id}`);
}

// ---- Notifications (in-app) ----

type ReportEventCtx = {
  title: string;
  reportId: string;
  projectId: string;
  creatorId: string | null;
  reason?: string;
};

async function notifyReportEvent(
  companyId: string,
  event: "submitted" | "approved" | "rejected",
  ctx: ReportEventCtx,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const link = `/reports/${ctx.reportId}`;

    if (event === "submitted") {
      // Notify all admins
      const { data: admins } = await admin
        .from("profiles")
        .select("id")
        .eq("audience", "internal")
        .eq("is_active", true)
        .is("deleted_at", null)
        .in("internal_role", ["super_admin", "admin"]);
      const targets = ((admins ?? []) as { id: string }[])
        .map((p) => p.id)
        .filter((id) => id !== ctx.creatorId);
      if (targets.length === 0) return;
      await admin.from("notifications").insert(
        targets.map((user_id) => ({
          user_id,
          company_id: companyId,
          channel: "in_app",
          title: "Báo cáo chờ anh/chị duyệt",
          body: `"${ctx.title}" đã được PM submit.`,
          link_url: link,
          entity_type: "report",
          entity_id: ctx.reportId,
        })),
      );
    } else if (event === "approved") {
      // Notify the creator + all customers in the company
      const rows: Array<Record<string, unknown>> = [];
      if (ctx.creatorId) {
        rows.push({
          user_id: ctx.creatorId,
          company_id: companyId,
          channel: "in_app",
          title: "Báo cáo đã được duyệt",
          body: `"${ctx.title}" đã publish cho khách.`,
          link_url: link,
          entity_type: "report",
          entity_id: ctx.reportId,
        });
      }
      const { data: members } = await admin
        .from("company_members")
        .select("user_id")
        .eq("company_id", companyId);
      for (const m of (members ?? []) as { user_id: string }[]) {
        rows.push({
          user_id: m.user_id,
          company_id: companyId,
          channel: "in_app",
          title: `Báo cáo định kỳ mới: ${ctx.title}`,
          body: "Clickstar vừa publish báo cáo định kỳ. Bấm để xem chi tiết.",
          link_url: link,
          entity_type: "report",
          entity_id: ctx.reportId,
        });
      }
      if (rows.length > 0) await admin.from("notifications").insert(rows);
    } else if (event === "rejected" && ctx.creatorId) {
      await admin.from("notifications").insert([
        {
          user_id: ctx.creatorId,
          company_id: companyId,
          channel: "in_app",
          title: "Báo cáo bị từ chối",
          body: `"${ctx.title}" cần sửa lại. Lý do: ${ctx.reason ?? ""}`,
          link_url: link,
          entity_type: "report",
          entity_id: ctx.reportId,
        },
      ]);
    }
  } catch (err) {
    console.error("[notifications/report] error", err);
  }
}
