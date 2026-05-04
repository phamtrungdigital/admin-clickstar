import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiIntegrationRow, AiProvider } from "@/lib/database.types";

export type AiIntegrationListItem = AiIntegrationRow & {
  creator: { id: string; full_name: string } | null;
};

export async function listAiIntegrations(): Promise<AiIntegrationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_integrations")
    .select(
      `
      *,
      creator:profiles!ai_integrations_created_by_fkey ( id, full_name )
      `,
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown) as AiIntegrationListItem[];
}

export async function getAiIntegrationById(
  id: string,
): Promise<AiIntegrationListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_integrations")
    .select(
      `
      *,
      creator:profiles!ai_integrations_created_by_fkey ( id, full_name )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as unknown) as AiIntegrationListItem | null) ?? null;
}

/** Lấy active integration cho 1 provider (lần đầu tiên match). Service-role
 *  để vượt RLS — caller là server action / API route trusted. */
export async function getActiveAiIntegrationForProvider(
  provider: AiProvider,
): Promise<AiIntegrationRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_integrations")
    .select("*")
    .eq("provider", provider)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[ai] getActiveAiIntegrationForProvider failed", error);
    return null;
  }
  return (data as AiIntegrationRow | null) ?? null;
}

/** Lấy active integration đầu tiên (bất kỳ provider). Dùng khi UI/feature
 *  không bind cứng provider — vd "AI gen email" chấp nhận cả Anthropic +
 *  OpenAI. Order: Anthropic ưu tiên (chất lượng email tốt hơn). */
export async function getDefaultActiveAiIntegration(): Promise<
  AiIntegrationRow | null
> {
  const anthropic = await getActiveAiIntegrationForProvider("anthropic");
  if (anthropic) return anthropic;
  return getActiveAiIntegrationForProvider("openai");
}

/** Decrypt API key qua Postgres function `get_ai_integration_secret`.
 *  Chỉ service-role gọi được. */
export async function decryptAiIntegrationKey(
  integrationId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_ai_integration_secret", {
    integration_id: integrationId,
  });
  if (error) {
    console.error("[ai] decryptAiIntegrationKey failed", error);
    return null;
  }
  return (data as string | null) ?? null;
}
