"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInternalAction } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  createDocumentSchema,
  updateDocumentSchema,
  setDocumentVisibilitySchema,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type SetDocumentVisibilityInput,
} from "@/lib/validation/documents";

export type DocumentActionResult<T = void> =
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

export async function createDocumentAction(
  input: CreateDocumentInput,
): Promise<DocumentActionResult<{ id: string }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = createDocumentSchema.safeParse(input);
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

  const v = parsed.data;

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      company_id: v.company_id,
      contract_id: v.contract_id,
      project_id: v.project_id,
      ticket_id: v.ticket_id,
      kind: v.kind,
      name: v.name,
      description: v.description,
      storage_path: v.storage_path,
      mime_type: v.mime_type,
      size_bytes: v.size_bytes,
      visibility: v.visibility,
      uploaded_by: user.id,
    })
    .select("id, company_id")
    .single();
  if (error || !doc) {
    // The file was already uploaded to Storage but we failed to insert
    // the metadata row — clean up so we don't orphan bytes.
    await supabase.storage.from("documents").remove([v.storage_path]).catch(() => {});
    return { ok: false, message: error?.message ?? "Không lưu được tài liệu" };
  }

  await logAudit({
    user_id: user.id,
    company_id: doc.company_id,
    action: "create",
    entity_type: "document",
    entity_id: doc.id,
    new_value: { name: v.name, kind: v.kind, visibility: v.visibility },
  });

  revalidatePath("/documents");
  return { ok: true, data: { id: doc.id } };
}

export async function updateDocumentAction(
  id: string,
  input: UpdateDocumentInput,
): Promise<DocumentActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = updateDocumentSchema.safeParse(input);
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

  const { data: existing } = await supabase
    .from("documents")
    .select("id, company_id, name, kind, visibility")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, message: "Tài liệu không tồn tại" };

  const v = parsed.data;
  const { error } = await supabase
    .from("documents")
    .update({
      name: v.name,
      description: v.description,
      kind: v.kind,
      visibility: v.visibility,
      contract_id: v.contract_id,
      project_id: v.project_id,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user.id,
    company_id: existing.company_id as string,
    action: "update",
    entity_type: "document",
    entity_id: id,
    old_value: {
      name: existing.name,
      kind: existing.kind,
      visibility: existing.visibility,
    },
    new_value: { name: v.name, kind: v.kind, visibility: v.visibility },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true };
}

export async function setDocumentVisibilityAction(
  id: string,
  input: SetDocumentVisibilityInput,
): Promise<DocumentActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = setDocumentVisibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Trạng thái chia sẻ không hợp lệ" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { data: row, error } = await supabase
    .from("documents")
    .update({ visibility: parsed.data.visibility })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, company_id, visibility")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Tài liệu không tồn tại" };

  await logAudit({
    user_id: user.id,
    company_id: row.company_id as string,
    action: "update",
    entity_type: "document",
    entity_id: id,
    new_value: { visibility: parsed.data.visibility },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true };
}

/** Soft delete only — keep the storage object so audit trails work and
 *  super_admin can recover it manually. Hard cleanup happens out-of-band. */
export async function softDeleteDocumentAction(
  id: string,
): Promise<DocumentActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { data: row, error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, company_id, name")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Tài liệu không tồn tại" };

  await logAudit({
    user_id: user.id,
    company_id: row.company_id as string,
    action: "delete",
    entity_type: "document",
    entity_id: id,
    old_value: { name: row.name },
  });

  revalidatePath("/documents");
  return { ok: true };
}

/** Generate a short-lived signed URL for downloading. Used by row actions
 *  that can't directly call the storage SDK from a client component without
 *  bundling the user's session into the URL. */
export async function getDocumentDownloadUrlAction(
  id: string,
): Promise<DocumentActionResult<{ url: string; filename: string }>> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("documents")
    .select("storage_path, name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Tài liệu không tồn tại" };

  // Use service-role to mint the URL — the SELECT above already passed RLS,
  // so we know the caller is allowed to read this document.
  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from("documents")
    .createSignedUrl(row.storage_path as string, 60 * 10, {
      download: row.name as string,
    });
  if (signErr || !signed) {
    return { ok: false, message: signErr?.message ?? "Không tạo được link tải" };
  }

  return { ok: true, data: { url: signed.signedUrl, filename: row.name as string } };
}

export async function createDocumentAndRedirect(
  input: CreateDocumentInput,
): Promise<DocumentActionResult> {
  const result = await createDocumentAction(input);
  if (!result.ok) return result;
  redirect(`/documents/${result.data!.id}`);
}
