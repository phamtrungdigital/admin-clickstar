"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import { createEmptyProject, forkTemplateCore } from "@/lib/projects/fork";
import {
  createContractSchema,
  normalizeContractInput,
  updateContractSchema,
  type ContractServiceLineInput,
  type CreateContractInput,
  type UpdateContractInput,
} from "@/lib/validation/contracts";
import { logAudit } from "@/lib/audit";

export type ContractActionResult<T = void> =
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

function normalizeServiceLine(line: ContractServiceLineInput) {
  return {
    service_id: line.service_id,
    starts_at: line.starts_at?.length ? line.starts_at : null,
    ends_at: line.ends_at?.length ? line.ends_at : null,
    notes: line.notes?.length ? line.notes : null,
  };
}

export async function createContractAction(
  input: CreateContractInput,
): Promise<ContractActionResult<{ id: string }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = createContractSchema.safeParse(input);
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

  const payload = normalizeContractInput(parsed.data);

  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();

  if (error || !contract) {
    return { ok: false, message: error?.message ?? "Không tạo được hợp đồng" };
  }

  if (parsed.data.services.length > 0) {
    const lines = parsed.data.services.map((s) => ({
      contract_id: contract.id,
      ...normalizeServiceLine(s),
    }));
    const { error: linesError } = await supabase
      .from("contract_services")
      .insert(lines);
    if (linesError) {
      return {
        ok: false,
        message: `Đã tạo hợp đồng nhưng chưa gắn được dịch vụ: ${linesError.message}`,
      };
    }
  }

  // Phương án C: mỗi service line tạo 1 project — có template thì fork,
  // không template thì tạo project trống (PM thêm milestone ad-hoc sau).
  // Đảm bảo HĐ luôn có entity track triển khai cho từng service.
  const fallbackStartIso =
    payload.starts_at ?? new Date().toISOString().slice(0, 10);
  const failedForks: string[] = [];
  let createdCount = 0;

  for (const line of parsed.data.services) {
    const hasTemplate =
      typeof line.template_id === "string" && line.template_id.length > 0;
    const startsAt = line.starts_at?.length ? line.starts_at : fallbackStartIso;

    if (hasTemplate) {
      const projectName = await buildProjectName(
        supabase,
        line.service_id,
        line.template_id as string,
        payload.name as string,
      );
      const result = await forkTemplateCore(supabase, user.id, {
        contractId: contract.id,
        templateId: line.template_id as string,
        name: projectName,
        startsAt,
        pmId: null,
      });
      if (!result.ok) failedForks.push(`${projectName}: ${result.message}`);
      else createdCount += 1;
    } else {
      // Empty project — name từ service + customer
      const emptyName = await buildEmptyProjectName(
        supabase,
        line.service_id,
        payload.name as string,
      );
      const result = await createEmptyProject(supabase, user.id, {
        contractId: contract.id,
        name: emptyName,
        // schedulingMode default 'manual' (không có template offset)
      });
      if (!result.ok) failedForks.push(`${emptyName}: ${result.message}`);
      else createdCount += 1;
    }
  }

  await logAudit({
    user_id: user.id,
    company_id: payload.company_id,
    action: "create",
    entity_type: "contract",
    entity_id: contract.id,
    new_value: {
      name: payload.name,
      code: payload.code,
      status: payload.status,
      auto_created_projects: createdCount,
    },
  });

  revalidatePath("/contracts");
  revalidatePath("/projects");

  if (failedForks.length > 0) {
    return {
      ok: false,
      message: `Đã tạo hợp đồng nhưng một số template chưa fork được: ${failedForks.join("; ")}`,
    };
  }
  return { ok: true, data: { id: contract.id } };
}

async function buildProjectName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  serviceId: string,
  templateId: string,
  contractName: string,
): Promise<string> {
  const { data: service } = await supabase
    .from("services")
    .select("name")
    .eq("id", serviceId)
    .maybeSingle();
  const { data: template } = await supabase
    .from("service_templates")
    .select("name")
    .eq("id", templateId)
    .maybeSingle();
  const svcName = (service?.name as string | undefined) ?? "Dịch vụ";
  const tplName = (template?.name as string | undefined) ?? "Template";
  return `${svcName} (${tplName}) — ${contractName}`;
}

/** Project name khi không có template — chỉ service + contract */
async function buildEmptyProjectName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  serviceId: string,
  contractName: string,
): Promise<string> {
  const { data: service } = await supabase
    .from("services")
    .select("name")
    .eq("id", serviceId)
    .maybeSingle();
  const svcName = (service?.name as string | undefined) ?? "Dịch vụ";
  return `${svcName} — ${contractName}`;
}

export async function updateContractAction(
  id: string,
  input: UpdateContractInput,
): Promise<ContractActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = updateContractSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const payload = normalizeContractInput(parsed.data);

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from("contracts")
      .update(payload)
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
  }

  if (parsed.data.services !== undefined) {
    // Replace the contract's service lines wholesale; existing rows are
    // deleted and recreated. Keeps the form simple at the cost of losing
    // per-line history (acceptable for MVP).
    const { error: clearErr } = await supabase
      .from("contract_services")
      .delete()
      .eq("contract_id", id);
    if (clearErr) return { ok: false, message: clearErr.message };

    if (parsed.data.services.length > 0) {
      const lines = parsed.data.services.map((s) => ({
        contract_id: id,
        ...normalizeServiceLine(s),
      }));
      const { error: insertErr } = await supabase
        .from("contract_services")
        .insert(lines);
      if (insertErr) return { ok: false, message: insertErr.message };
    }
  }

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  return { ok: true };
}

export async function softDeleteContractAction(
  id: string,
): Promise<ContractActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Snapshot company_id for the audit row.
  const { data: before } = await supabase
    .from("contracts")
    .select("company_id, name")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("contracts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user?.id ?? null,
    company_id: before?.company_id ?? null,
    action: "delete",
    entity_type: "contract",
    entity_id: id,
    old_value: before,
  });

  revalidatePath("/contracts");
  return { ok: true };
}

// PDF uploads are performed directly from the browser via supabase-js
// (see src/components/contracts/contract-attachment-field.tsx). That
// path bypasses Next.js server-action body limits and is faster.

export async function getContractAttachmentUrlAction(
  contractId: string,
): Promise<ContractActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("attachment_url")
    .eq("id", contractId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!contract?.attachment_url) {
    return { ok: false, message: "Hợp đồng chưa có tệp đính kèm" };
  }

  const value = contract.attachment_url as string;
  if (/^https?:\/\//.test(value)) {
    return { ok: true, data: { url: value } };
  }

  // Treat as storage path; sign a 1-hour download URL.
  const { data: signed, error: signErr } = await supabase.storage
    .from("documents")
    .createSignedUrl(value, 60 * 60);
  if (signErr || !signed) {
    return { ok: false, message: signErr?.message ?? "Không tạo được link tải" };
  }
  return { ok: true, data: { url: signed.signedUrl } };
}
