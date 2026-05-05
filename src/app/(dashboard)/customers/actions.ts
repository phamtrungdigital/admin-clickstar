"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInternalAction, canManageCustomers } from "@/lib/auth/guards";
import {
  createCompanySchema,
  normalizeCompanyInput,
  updateCompanySchema,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from "@/lib/validation/companies";
import { onboardSchema, type OnboardInput } from "@/lib/validation/onboard";
import { createContractAction } from "@/app/(dashboard)/contracts/actions";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export type CustomerCascadeCounts = {
  projects: number;
  tasks: number;
  tickets: number;
  contracts: number;
  documents: number;
};

/**
 * Đếm trước số entity sẽ bị cascade khi soft-delete KH. Dùng để confirm
 * dialog hiện cho admin biết phạm vi ảnh hưởng. Bypass RLS qua admin
 * client để đảm bảo count chính xác kể cả khi caller không có quyền
 * read trực tiếp các entity (vd manager khác chi nhánh).
 */
export async function getCustomerCascadeCounts(
  companyId: string,
): Promise<CustomerCascadeCounts> {
  const guard = await requireInternalAction();
  if (!guard.ok) {
    return { projects: 0, tasks: 0, tickets: 0, contracts: 0, documents: 0 };
  }
  const admin = createAdminClient();
  const [p, t, tk, c, d] = await Promise.all([
    admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null),
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null),
    admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null),
    admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ]);
  return {
    projects: p.count ?? 0,
    tasks: t.count ?? 0,
    tickets: tk.count ?? 0,
    contracts: c.count ?? 0,
    documents: d.count ?? 0,
  };
}

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
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
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

  const { primary_account_manager_id: requestedAm, service_ids, ...rest } =
    parsed.data;
  const payload = normalizeCompanyInput(rest);

  // Defence-in-depth: only manager/admin/super_admin can pick someone
  // else as Account Manager. Staff/support/accountant always become the
  // AM themselves regardless of what the form posts.
  const primary_account_manager_id = canManageCustomers(guard.profile)
    ? requestedAm
    : user.id;

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

  // Auto-provision tài khoản portal cho khách + bắn welcome email.
  // Non-fatal: nếu auth.createUser fail (vd. email đã tồn tại) → company
  // vẫn được tạo, admin nhận warning để xử lý thủ công sau.
  let provisionWarning: string | null = null;
  if (payload.email) {
    const result = await provisionCustomerAccount({
      email: payload.email as string,
      companyId: company.id,
      companyName: payload.name as string,
      contactName: (payload.representative as string | null) ?? null,
    });
    if (!result.ok) provisionWarning = result.warning;
  }

  revalidatePath("/customers");
  return {
    ok: true,
    data: { id: company.id },
    ...(provisionWarning ? { message: provisionWarning } : {}),
  } as ActionResult<{ id: string }> & { message?: string };
}

/**
 * Tạo tài khoản Supabase Auth cho khách hàng + link vào company_members
 * + bắn welcome email với mật khẩu tạm.
 *
 * Non-fatal — return { ok: false, warning } để caller log warning chứ
 * không rollback company creation. Trường hợp phổ biến cần soft-fail:
 *   - Email đã tồn tại (đã có account) → chỉ link company_member, skip
 *     gửi email (vì user đã có credentials cũ)
 *   - RESEND_API_KEY thiếu → email không gửi được nhưng account vẫn tạo
 */
async function provisionCustomerAccount(args: {
  email: string;
  companyId: string;
  companyName: string;
  contactName: string | null;
}): Promise<{ ok: true } | { ok: false; warning: string }> {
  const admin = createAdminClient();

  // Generate mật khẩu tạm: 12 ký tự, đủ entropy + dễ đọc lại nếu khách
  // không nhận được email (admin có thể tra log).
  const password = generateTempPassword();

  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: args.email,
      password,
      email_confirm: true, // bypass email verify, account hoạt động ngay
      user_metadata: {
        audience: "customer",
        full_name: args.contactName ?? args.companyName,
      },
    },
  );

  if (createErr) {
    // Email đã tồn tại trong auth → admin cần link thủ công qua tab
    // "Tài khoản" của customer detail (hiện tại vào /customers/[id] →
    // tab "Tài khoản" có UI add member by email).
    const isEmailExists =
      createErr.message.toLowerCase().includes("already") ||
      (createErr as { code?: string }).code === "email_exists";
    return {
      ok: false,
      warning: isEmailExists
        ? `Email "${args.email}" đã có tài khoản portal. Vào tab "Tài khoản" của khách hàng để link.`
        : `Không tạo được tài khoản portal: ${createErr.message}`,
    };
  }

  const userId = created?.user?.id ?? null;
  if (!userId) {
    return { ok: false, warning: "Supabase không trả user_id sau khi tạo" };
  }

  // 2. Link user vào company_members (role: viewer)
  const { error: linkErr } = await admin
    .from("company_members")
    .upsert(
      {
        company_id: args.companyId,
        user_id: userId,
        role: "viewer",
      },
      { onConflict: "company_id,user_id" },
    );
  if (linkErr) {
    return {
      ok: false,
      warning: `Đã tạo account nhưng chưa link được vào company: ${linkErr.message}`,
    };
  }

  // 3. Gửi welcome email với credentials
  {
    const loginUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://portal.clickstar.vn";
    await sendEmail({
      templateCode: "customer_welcome",
      recipientEmail: args.email,
      recipientUserId: userId,
      companyId: args.companyId,
      vars: {
        company_name: args.companyName,
        contact_name: args.contactName ?? args.companyName,
        login_email: args.email,
        login_password: password,
        login_url: loginUrl,
      },
    }).catch((err) => {
      console.error("[customer-welcome] email send failed", err);
    });
  }

  return { ok: true };
}

function generateTempPassword(): string {
  // 12 ký tự alphanum + 1 special — bypass weak-password rules of Supabase
  const chars =
    "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 11; i++) {
    p += chars[Math.floor(Math.random() * chars.length)];
  }
  return p + "!";
}

export async function updateCustomerAction(
  id: string,
  input: UpdateCompanyInput,
): Promise<ActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { primary_account_manager_id: requestedAm, service_ids, ...rest } =
    parsed.data;
  const payload = normalizeCompanyInput(rest);

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from("companies")
      .update(payload)
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
  }

  // Lower-tier roles cannot reassign the AM — silently ignore the field
  // even if it came through the form (which currently disables it). They
  // can still update the rest of the customer's data.
  const primary_account_manager_id = canManageCustomers(guard.profile)
    ? requestedAm
    : undefined;

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

export async function softDeleteCustomerAction(
  id: string,
): Promise<ActionResult<{ cascade: CustomerCascadeCounts }>> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  // Soft-delete is sensitive — restrict to manager/admin/super_admin even
  // though RLS would let any internal UPDATE companies they can access.
  if (!canManageCustomers(guard.profile)) {
    return {
      ok: false,
      message:
        "Bạn không có quyền xoá khách hàng. Vui lòng liên hệ Manager hoặc Admin.",
    };
  }
  // Đếm trước để báo cho user biết đã cascade bao nhiêu (toast sau khi
  // xoá thành công). Trigger DB cascade_company_soft_delete tự xoá theo
  // — code ở đây chỉ để đếm.
  const cascade = await getCustomerCascadeCounts(id);

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
    new_value: { cascade },
  });

  revalidatePath("/customers");
  revalidatePath("/projects");
  revalidatePath("/tickets");
  revalidatePath("/contracts");
  revalidatePath("/documents");
  return { ok: true, data: { cascade } };
}

export async function createCustomerAndRedirect(
  input: CreateCompanyInput,
): Promise<ActionResult> {
  const result = await createCustomerAction(input);
  if (!result.ok) return result;
  redirect(`/customers/${result.data!.id}`);
}

const CUSTOMER_ROLES = ["owner", "marketing_manager", "viewer"] as const;
type CustomerRole = (typeof CUSTOMER_ROLES)[number];

export async function addCompanyMemberByEmailAction(
  companyId: string,
  email: string,
  role: CustomerRole = "viewer",
): Promise<ActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { ok: false, message: "Email không hợp lệ" };
  }
  if (!CUSTOMER_ROLES.includes(role)) {
    return { ok: false, message: "Vai trò không hợp lệ" };
  }

  const supabase = await createClient();

  const { data: profile, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, audience, full_name, email")
    .eq("email", trimmed)
    .is("deleted_at", null)
    .maybeSingle();
  if (lookupErr) return { ok: false, message: lookupErr.message };
  if (!profile) {
    return {
      ok: false,
      message: "Chưa có tài khoản nào dùng email này. Tạo tài khoản customer trước rồi gắn vào doanh nghiệp.",
    };
  }
  if (profile.audience !== "customer") {
    return {
      ok: false,
      message: "Chỉ tài khoản customer mới gắn được vào doanh nghiệp.",
    };
  }

  const { error: insertErr } = await supabase
    .from("company_members")
    .upsert(
      { company_id: companyId, user_id: profile.id, role },
      { onConflict: "company_id,user_id" },
    );
  if (insertErr) return { ok: false, message: insertErr.message };

  await logAudit({
    user_id: guard.profile.id,
    company_id: companyId,
    action: "update",
    entity_type: "company_member",
    entity_id: profile.id,
    new_value: { email: profile.email, role },
  });

  revalidatePath(`/customers/${companyId}`);
  return { ok: true };
}

export async function updateCompanyMemberRoleAction(
  companyId: string,
  userId: string,
  role: CustomerRole,
): Promise<ActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  if (!CUSTOMER_ROLES.includes(role)) {
    return { ok: false, message: "Vai trò không hợp lệ" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_members")
    .update({ role })
    .eq("company_id", companyId)
    .eq("user_id", userId);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: guard.profile.id,
    company_id: companyId,
    action: "update",
    entity_type: "company_member",
    entity_id: userId,
    new_value: { role },
  });

  revalidatePath(`/customers/${companyId}`);
  return { ok: true };
}

export async function removeCompanyMemberAction(
  companyId: string,
  userId: string,
): Promise<ActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_members")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", userId);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: guard.profile.id,
    company_id: companyId,
    action: "delete",
    entity_type: "company_member",
    entity_id: userId,
  });

  revalidatePath(`/customers/${companyId}`);
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Onboard wizard — composite create (customer + optional contract).
// ────────────────────────────────────────────────────────────────────────────

export type OnboardActionResult = ActionResult<{
  customerId: string;
  contractId: string | null;
  /** Set when contract was attempted but failed — UI surfaces a partial-
   *  success message and routes the user to /customers/{id} to retry. */
  contractWarning: string | null;
}>;

/**
 * Sequential, best-effort:
 *  1) Create the customer (delegates to createCustomerAction so the role-
 *     based AM enforcement, audit logging, and RLS rules stay consistent).
 *  2) If the wizard included contract data, create the contract for that
 *     new customer (delegates to createContractAction — already handles
 *     auto-fork of templates per service line).
 *
 * If step 2 fails after step 1 succeeded we DON'T roll back the customer:
 * fork-template side effects span multiple tables and the cascade undo is
 * messy; the user usually still wants the customer recorded and can finish
 * the contract from /customers/{id}.
 */
export async function onboardCustomerAction(
  input: OnboardInput,
): Promise<OnboardActionResult> {
  const parsed = onboardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const customerResult = await createCustomerAction(parsed.data.customer);
  if (!customerResult.ok) return customerResult;
  const customerId = customerResult.data!.id;

  const contractInput = parsed.data.contract;
  if (!contractInput) {
    revalidatePath("/customers");
    return {
      ok: true,
      data: { customerId, contractId: null, contractWarning: null },
    };
  }

  const contractResult = await createContractAction({
    ...contractInput,
    company_id: customerId,
  });
  if (!contractResult.ok) {
    return {
      ok: true,
      data: {
        customerId,
        contractId: null,
        contractWarning: contractResult.message,
      },
    };
  }

  revalidatePath("/customers");
  revalidatePath("/contracts");
  revalidatePath("/projects");
  return {
    ok: true,
    data: {
      customerId,
      contractId: contractResult.data!.id,
      contractWarning: null,
    },
  };
}

export async function onboardCustomerAndRedirect(
  input: OnboardInput,
): Promise<OnboardActionResult> {
  const result = await onboardCustomerAction(input);
  if (!result.ok) return result;
  const target = result.data!.contractId
    ? `/contracts/${result.data!.contractId}`
    : `/customers/${result.data!.customerId}`;
  redirect(target);
}
