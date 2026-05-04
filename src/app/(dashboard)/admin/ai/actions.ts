"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  upsertAiIntegrationSchema,
  maskApiKey,
  type UpsertAiIntegrationInput,
} from "@/lib/validation/ai-integrations";
import { decryptAiIntegrationKey } from "@/lib/queries/ai-integrations";

export type AiActionResult =
  | { ok: true; data?: { id: string } }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function flattenZodErrors(
  error: import("zod").ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function requireSuperAdmin() {
  const guard = await requireInternalAction();
  if (!guard.ok) return guard;
  if (
    guard.profile.internal_role !== "super_admin"
    && guard.profile.internal_role !== "admin"
  ) {
    return {
      ok: false as const,
      message: "Chỉ Super Admin / Admin được quản lý API key AI.",
    };
  }
  return guard;
}

export async function createAiIntegrationAction(
  input: UpsertAiIntegrationInput,
): Promise<AiActionResult> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = upsertAiIntegrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  if (!parsed.data.api_key) {
    return {
      ok: false,
      message: "API key bắt buộc khi tạo mới",
      fieldErrors: { api_key: "Nhập API key" },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const admin = createAdminClient();

  // 1. Lưu plaintext key vào vault.secrets — Supabase tự encrypt qua
  // pgsodium. Trả về uuid mà KHÔNG ai (kể cả admin) có thể decrypt qua
  // SQL thông thường — chỉ qua function security definer of ours.
  const secretName = `ai_${parsed.data.provider}_${Date.now()}`;
  const { data: secretId, error: secretErr } = await admin.rpc(
    "vault_create_secret",
    {
      new_secret: parsed.data.api_key,
      new_name: secretName,
      new_description: parsed.data.label || `${parsed.data.provider} key`,
    } as never,
  );
  if (secretErr || !secretId) {
    return {
      ok: false,
      message: `Không lưu được key vào Vault: ${secretErr?.message ?? "unknown"}`,
    };
  }

  const mask = maskApiKey(parsed.data.api_key);
  const { data, error } = await admin
    .from("ai_integrations")
    .insert({
      provider: parsed.data.provider,
      model: parsed.data.model,
      vault_secret_id: secretId as string,
      key_mask: mask,
      label: parsed.data.label || null,
      notes: parsed.data.notes || null,
      is_active: parsed.data.is_active,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Không lưu được integration",
    };
  }

  await logAudit({
    user_id: user.id,
    action: "create",
    entity_type: "system_settings",
    entity_id: data.id as string,
    new_value: {
      kind: "ai_integration",
      provider: parsed.data.provider,
      model: parsed.data.model,
      label: parsed.data.label,
    },
  });

  revalidatePath("/admin/settings");
  return { ok: true, data: { id: data.id as string } };
}

export async function updateAiIntegrationAction(
  id: string,
  input: UpsertAiIntegrationInput,
): Promise<AiActionResult> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = upsertAiIntegrationSchema.safeParse(input);
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

  const admin = createAdminClient();

  // Look up current row để biết vault_secret_id (rotate key nếu user nhập)
  const { data: existing } = await admin
    .from("ai_integrations")
    .select("vault_secret_id, provider")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return { ok: false, message: "Integration không tồn tại" };
  }

  const updates: Record<string, unknown> = {
    provider: parsed.data.provider,
    model: parsed.data.model,
    label: parsed.data.label || null,
    notes: parsed.data.notes || null,
    is_active: parsed.data.is_active,
  };

  // Nếu user nhập api_key mới (không rỗng) → rotate trong vault.
  if (parsed.data.api_key) {
    const { error: rotateErr } = await admin.rpc("vault_update_secret", {
      secret_id: existing.vault_secret_id as string,
      new_secret: parsed.data.api_key,
      new_name: null,
      new_description: null,
    } as never);
    if (rotateErr) {
      return {
        ok: false,
        message: `Không rotate được key: ${rotateErr.message}`,
      };
    }
    updates.key_mask = maskApiKey(parsed.data.api_key);
  }

  const { error } = await admin
    .from("ai_integrations")
    .update(updates)
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user.id,
    action: "update",
    entity_type: "system_settings",
    entity_id: id,
    new_value: {
      kind: "ai_integration",
      key_rotated: !!parsed.data.api_key,
      provider: parsed.data.provider,
      model: parsed.data.model,
    },
  });

  revalidatePath("/admin/settings");
  return { ok: true, data: { id } };
}

export async function deleteAiIntegrationAction(
  id: string,
): Promise<AiActionResult> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, message: guard.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const admin = createAdminClient();
  // Lấy vault_secret_id để xoá secret luôn
  const { data: existing } = await admin
    .from("ai_integrations")
    .select("vault_secret_id, provider")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, message: "Integration không tồn tại" };

  const { error } = await admin.from("ai_integrations").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  // Xoá secret khỏi vault — best-effort, non-fatal
  try {
    await admin.rpc("vault_delete_secret", {
      secret_id: existing.vault_secret_id as string,
    } as never);
  } catch (err) {
    console.error("[ai] vault secret delete failed", err);
  }

  await logAudit({
    user_id: user.id,
    action: "delete",
    entity_type: "system_settings",
    entity_id: id,
    old_value: { kind: "ai_integration", provider: existing.provider },
  });

  revalidatePath("/admin/settings");
  return { ok: true };
}

/** Test 1 prompt nhỏ với key + model hiện tại — verify integration
 *  hoạt động trước khi đưa vào production. Trả về câu trả lời ngắn. */
export async function testAiIntegrationAction(
  id: string,
): Promise<{ ok: true; reply: string } | { ok: false; message: string }> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, message: guard.message };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("ai_integrations")
    .select("provider, model")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, message: "Integration không tồn tại" };

  const apiKey = await decryptAiIntegrationKey(id);
  if (!apiKey) {
    return { ok: false, message: "Không lấy được key từ Vault" };
  }

  const prompt = "Reply 1 câu tiếng Việt: bạn đang hoạt động không?";
  try {
    if (row.provider === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model: row.model as string,
        max_tokens: 64,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n");
      return { ok: true, reply: text.trim() || "(empty)" };
    } else {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      const resp = await client.chat.completions.create({
        model: row.model as string,
        max_completion_tokens: 64,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.choices[0]?.message?.content ?? "";
      return { ok: true, reply: text.trim() || "(empty)" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI call lỗi";
    return { ok: false, message: msg };
  }
}
