import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logAudit } from "@/lib/audit";

export type ForkTemplateCoreInput = {
  contractId: string;
  templateId: string;
  name: string;
  startsAt: string; // 'yyyy-MM-dd'
  pmId: string | null;
};

export type ForkTemplateCoreResult =
  | { ok: true; data: { projectId: string } }
  | { ok: false; message: string };

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure (no auth gate) implementation of "clone a template into a project".
 * Callers are responsible for authenticating and authorising. Used by:
 * - projects/actions.ts forkTemplateAction (single fork from contract detail)
 * - contracts/actions.ts createContractAction (auto-fork on contract create)
 *
 * Side effects: inserts project + milestones + tasks + task_checklist_items,
 * writes 1 audit_logs row. Idempotency: NOT idempotent — calling twice creates
 * two projects.
 */
export async function forkTemplateCore(
  supabase: SupabaseClient,
  userId: string,
  input: ForkTemplateCoreInput,
): Promise<ForkTemplateCoreResult> {
  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("id, company_id")
    .eq("id", input.contractId)
    .is("deleted_at", null)
    .maybeSingle();
  if (cErr) return { ok: false, message: cErr.message };
  if (!contract) return { ok: false, message: "Hợp đồng không tồn tại" };

  const { data: template, error: tErr } = await supabase
    .from("service_templates")
    .select("id, version, duration_days")
    .eq("id", input.templateId)
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

  const tplTaskIds = (tplTasks ?? []).map((t) => t.id as string);
  let tplChecklists: Array<{
    template_task_id: string;
    content: string;
    sort_order: number;
  }> = [];
  if (tplTaskIds.length > 0) {
    const { data: cl, error: clErr } = await supabase
      .from("template_checklist_items")
      .select("template_task_id, content, sort_order")
      .in("template_task_id", tplTaskIds)
      .order("sort_order", { ascending: true });
    if (clErr) return { ok: false, message: clErr.message };
    tplChecklists = (cl ?? []) as typeof tplChecklists;
  }

  const startsAt = input.startsAt;
  const endsAt = addDays(startsAt, template.duration_days ?? 30);

  // Auto-pick PM nếu caller không truyền: ưu tiên primary AM của
  // company → AM bất kỳ → bất kỳ staff được assign company. Tránh
  // project bị "Chưa gán" lúc khách view.
  let resolvedPmId: string | null = input.pmId;
  if (!resolvedPmId) {
    // Primary AM
    const { data: primaryAm } = await supabase
      .from("company_assignments")
      .select("internal_user_id")
      .eq("company_id", contract.company_id)
      .eq("role", "account_manager")
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    resolvedPmId = (primaryAm?.internal_user_id as string | null) ?? null;
    // Bất kỳ AM
    if (!resolvedPmId) {
      const { data: anyAm } = await supabase
        .from("company_assignments")
        .select("internal_user_id")
        .eq("company_id", contract.company_id)
        .eq("role", "account_manager")
        .limit(1)
        .maybeSingle();
      resolvedPmId = (anyAm?.internal_user_id as string | null) ?? null;
    }
    // Bất kỳ assignment
    if (!resolvedPmId) {
      const { data: anyStaff } = await supabase
        .from("company_assignments")
        .select("internal_user_id")
        .eq("company_id", contract.company_id)
        .limit(1)
        .maybeSingle();
      resolvedPmId = (anyStaff?.internal_user_id as string | null) ?? null;
    }
    // Fallback cuối cùng: người tạo project (admin/manager)
    if (!resolvedPmId) {
      resolvedPmId = userId;
    }
  }

  // 1) Create project
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .insert({
      company_id: contract.company_id,
      contract_id: contract.id,
      template_id: template.id,
      template_version: template.version,
      pm_id: resolvedPmId,
      name: input.name,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "not_started",
      created_by: userId,
    })
    .select("id")
    .single();
  if (pErr || !project) {
    return { ok: false, message: pErr?.message ?? "Không tạo được dự án" };
  }

  // 2) Clone milestones
  const milestoneMap = new Map<string, string>();
  if (tplMilestones && tplMilestones.length > 0) {
    const rows = tplMilestones.map((m) => ({
      project_id: project.id,
      template_milestone_id: m.id,
      code: m.code,
      title: m.title,
      description: m.description,
      sort_order: m.sort_order,
      starts_at: addDays(startsAt, m.offset_start_days as number),
      ends_at: addDays(startsAt, m.offset_end_days as number),
      deliverable_required: m.deliverable_required,
      status: "not_started" as const,
    }));
    const { data: inserted, error: imErr } = await supabase
      .from("milestones")
      .insert(rows)
      .select("id, template_milestone_id");
    if (imErr) return { ok: false, message: imErr.message };
    for (const m of inserted ?? []) {
      if (m.template_milestone_id) {
        milestoneMap.set(m.template_milestone_id as string, m.id as string);
      }
    }
  }

  // 3) Clone tasks
  const tplTaskToTaskId = new Map<string, string>();
  if (tplTasks && tplTasks.length > 0) {
    const rows = tplTasks.map((t) => {
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
        created_by: userId,
      };
    });
    const { data: inserted, error: itErr } = await supabase
      .from("tasks")
      .insert(rows)
      .select("id, template_task_id");
    if (itErr) return { ok: false, message: itErr.message };
    for (const t of inserted ?? []) {
      if (t.template_task_id) {
        tplTaskToTaskId.set(t.template_task_id as string, t.id as string);
      }
    }
  }

  // 4) Clone checklist
  if (tplChecklists.length > 0 && tplTaskToTaskId.size > 0) {
    const rows = tplChecklists
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
    if (rows.length > 0) {
      const { error: icErr } = await supabase
        .from("task_checklist_items")
        .insert(rows);
      if (icErr) return { ok: false, message: icErr.message };
    }
  }

  await logAudit({
    user_id: userId,
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

  return { ok: true, data: { projectId: project.id } };
}
