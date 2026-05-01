"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createCompanySchema,
  normalizeCompanyInput,
  updateCompanySchema,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from "@/lib/validation/companies";
import { logAudit } from "@/lib/audit";

export type ActionResult<T = void> =
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

export async function createCustomerAction(
  input: CreateCompanyInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCompanySchema.safeParse(input);
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

  const { primary_account_manager_id, service_ids, ...rest } = parsed.data;
  const payload = normalizeCompanyInput(rest);

  const { data: company, error } = await supabase
    .from("companies")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();

  if (error || !company) {
    return { ok: false, message: error?.message ?? "Không tạo được khách hàng" };
  }

  if (primary_account_manager_id) {
    const { error: assignErr } = await supabase
      .from("company_assignments")
      .insert({
        company_id: company.id,
        internal_user_id: primary_account_manager_id,
        role: "account_manager",
        is_primary: true,
      });
    if (assignErr) {
      // Customer was created; surface the partial failure but don't roll back
      return {
        ok: false,
        message: `Đã tạo khách hàng nhưng chưa gán được người phụ trách: ${assignErr.message}`,
      };
    }
  }

  if (service_ids && service_ids.length > 0) {
    const { error: svcErr } = await supabase
      .from("company_services")
      .insert(
        service_ids.map((service_id) => ({
          company_id: company.id,
          service_id,
        })),
      );
    if (svcErr) {
      return {
        ok: false,
        message: `Đã tạo khách hàng nhưng chưa gắn được dịch vụ: ${svcErr.message}`,
      };
    }
  }

  await logAudit({
    user_id: user.id,
    company_id: company.id,
    action: "create",
    entity_type: "company",
    entity_id: company.id,
    new_value: {
      name: payload.name,
      code: payload.code,
      status: payload.status,
    },
  });

  revalidatePath("/customers");
  return { ok: true, data: { id: company.id } };
}

export async function updateCustomerAction(
  id: string,
  input: UpdateCompanyInput,
): Promise<ActionResult> {
  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { primary_account_manager_id, service_ids, ...rest } = parsed.data;
  const payload = normalizeCompanyInput(rest);

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from("companies")
      .update(payload)
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
  }

  if (primary_account_manager_id !== undefined) {
    // Replace any existing primary account manager assignment
    const { error: clearErr } = await supabase
      .from("company_assignments")
      .delete()
      .eq("company_id", id)
      .eq("role", "account_manager")
      .eq("is_primary", true);
    if (clearErr) return { ok: false, message: clearErr.message };

    if (primary_account_manager_id) {
      const { error: insertErr } = await supabase
        .from("company_assignments")
        .insert({
          company_id: id,
          internal_user_id: primary_account_manager_id,
          role: "account_manager",
          is_primary: true,
        });
      if (insertErr) return { ok: false, message: insertErr.message };
    }
  }

  if (service_ids !== undefined) {
    // Replace the entire set: delete all then insert the new selection.
    const { error: clearErr } = await supabase
      .from("company_services")
      .delete()
      .eq("company_id", id);
    if (clearErr) return { ok: false, message: clearErr.message };

    if (service_ids.length > 0) {
      const { error: insertErr } = await supabase
        .from("company_services")
        .insert(
          service_ids.map((service_id) => ({ company_id: id, service_id })),
        );
      if (insertErr) return { ok: false, message: insertErr.message };
    }
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function softDeleteCustomerAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user?.id ?? null,
    company_id: id,
    action: "delete",
    entity_type: "company",
    entity_id: id,
  });

  revalidatePath("/customers");
  return { ok: true };
}

export async function createCustomerAndRedirect(
  input: CreateCompanyInput,
): Promise<ActionResult> {
  const result = await createCustomerAction(input);
  if (!result.ok) return result;
  redirect(`/customers/${result.data!.id}`);
}
