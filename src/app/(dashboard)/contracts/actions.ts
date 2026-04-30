"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import {
  contractServiceLineSchema,
  createContractSchema,
  normalizeContractInput,
  updateContractSchema,
  type ContractServiceLineInput,
  type CreateContractInput,
  type UpdateContractInput,
} from "@/lib/validation/contracts";

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
    unit_price: line.unit_price,
    quantity: line.quantity,
    starts_at: line.starts_at?.length ? line.starts_at : null,
    ends_at: line.ends_at?.length ? line.ends_at : null,
    notes: line.notes?.length ? line.notes : null,
  };
}

export async function createContractAction(
  input: CreateContractInput,
): Promise<ContractActionResult<{ id: string }>> {
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

  revalidatePath("/contracts");
  return { ok: true, data: { id: contract.id } };
}

export async function updateContractAction(
  id: string,
  input: UpdateContractInput,
): Promise<ContractActionResult> {
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/contracts");
  return { ok: true };
}

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Receives a multipart upload from the contract form, stores the file in
 * the documents bucket and returns the storage object path. The path is
 * later saved on contracts.attachment_url; download URLs are signed on
 * demand by getContractAttachmentUrlAction.
 */
export async function uploadContractAttachmentAction(
  formData: FormData,
): Promise<ContractActionResult<{ path: string; filename: string }>> {
  const file = formData.get("file");
  const companyId = formData.get("company_id");

  if (!(file instanceof File)) {
    return { ok: false, message: "Không nhận được tệp" };
  }
  if (typeof companyId !== "string" || !companyId) {
    return { ok: false, message: "Thiếu company_id" };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, message: "Chỉ hỗ trợ tệp PDF" };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, message: `Tệp quá ${MAX_PDF_BYTES / 1024 / 1024} MB` };
  }

  const supabase = await createClient();
  const extension = file.name.split(".").pop() || "pdf";
  const path = `companies/${companyId}/contracts/${randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("documents")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return { ok: false, message: `Không upload được: ${error.message}` };
  }

  return { ok: true, data: { path, filename: file.name } };
}

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

export { contractServiceLineSchema };
