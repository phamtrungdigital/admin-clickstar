"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createServiceSchema,
  normalizeServiceInput,
  updateServiceSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
} from "@/lib/validation/services";

export type ServiceActionResult<T = void> =
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

export async function createServiceAction(
  input: CreateServiceInput,
): Promise<ServiceActionResult<{ id: string }>> {
  const parsed = createServiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const payload = normalizeServiceInput(parsed.data);

  const { data, error } = await supabase
    .from("services")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không tạo được dịch vụ" };
  }

  revalidatePath("/services");
  return { ok: true, data: { id: data.id } };
}

export async function updateServiceAction(
  id: string,
  input: UpdateServiceInput,
): Promise<ServiceActionResult> {
  const parsed = updateServiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const payload = normalizeServiceInput(parsed.data);

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
  return { ok: true };
}

export async function toggleServiceActiveAction(
  id: string,
  next: boolean,
): Promise<ServiceActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ is_active: next })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
  return { ok: true };
}

export async function deleteServiceAction(
  id: string,
): Promise<ServiceActionResult> {
  const supabase = await createClient();
  // services has no deleted_at; hard-delete is allowed only when no
  // contract_services references the row (FK is ON DELETE RESTRICT).
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        message:
          "Dịch vụ này đang được dùng trong hợp đồng — không thể xoá. Hãy đặt trạng thái Tạm ngưng.",
      };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/services");
  return { ok: true };
}
