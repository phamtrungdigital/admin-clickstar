import "server-only";

import {
  decryptAiIntegrationKey,
  getDefaultActiveAiIntegration,
} from "@/lib/queries/ai-integrations";
import type { AiProvider } from "@/lib/database.types";

export type AiCallArgs = {
  /** System prompt — instructions cho model. */
  system: string;
  /** User prompt — yêu cầu cụ thể. */
  user: string;
  /** Tùy chọn: max output tokens, default 2048. */
  maxTokens?: number;
};

export type AiCallResult =
  | { ok: true; text: string; provider: AiProvider; model: string }
  | { ok: false; reason: string };

/**
 * Call active AI integration với system + user prompt. Anthropic ưu tiên
 * (chất lượng output tốt hơn cho writing tiếng Việt). Nếu không có
 * integration active nào → return ok=false để caller surface message
 * cho admin biết.
 *
 * Output là plaintext — chỉ dùng cho free-form gen. Caller tự parse JSON
 * nếu cần (vd email gen yêu cầu trả JSON output).
 */
export async function callActiveAi(args: AiCallArgs): Promise<AiCallResult> {
  const integration = await getDefaultActiveAiIntegration();
  if (!integration) {
    return {
      ok: false,
      reason:
        "Chưa có AI integration active. Vào Cài đặt hệ thống > Tích hợp AI để cấu hình.",
    };
  }

  const apiKey = await decryptAiIntegrationKey(integration.id);
  if (!apiKey) {
    return { ok: false, reason: "Không lấy được key từ Vault" };
  }

  const maxTokens = args.maxTokens ?? 2048;

  try {
    if (integration.provider === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model: integration.model,
        max_tokens: maxTokens,
        system: args.system,
        messages: [{ role: "user", content: args.user }],
      });
      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n");
      return {
        ok: true,
        text: text.trim(),
        provider: integration.provider,
        model: integration.model,
      };
    } else {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      const resp = await client.chat.completions.create({
        model: integration.model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      });
      const text = resp.choices[0]?.message?.content ?? "";
      return {
        ok: true,
        text: text.trim(),
        provider: integration.provider,
        model: integration.model,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI call lỗi";
    return { ok: false, reason: msg };
  }
}
