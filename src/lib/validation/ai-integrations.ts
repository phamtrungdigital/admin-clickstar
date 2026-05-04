import { z } from "zod";

const trimmed = z.string().trim();

export const AI_PROVIDERS = ["anthropic", "openai"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Models hỗ trợ — sync với UI dropdown. Default đầu tiên là "best for
 *  email design" của mỗi provider. Em thêm model mới khi anh cần. */
export const AI_MODELS: Record<AiProvider, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (recommend)" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4 (chất lượng cao nhất)" },
    { value: "claude-3-5-haiku-20241022", label: "Claude Haiku 3.5 (nhanh, rẻ)" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o (recommend)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (nhanh, rẻ)" },
    { value: "o3-mini", label: "o3 mini (reasoning)" },
  ],
};

export const upsertAiIntegrationSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: trimmed.min(1, "Chọn model").max(128),
  /** Plain key — chỉ accept khi tạo mới, hoặc khi user explicit đổi key
   *  ở edit form. Empty string = giữ nguyên key cũ. */
  api_key: trimmed.max(512),
  label: trimmed.max(128),
  notes: trimmed.max(2000),
  is_active: z.boolean(),
});
export type UpsertAiIntegrationInput = z.infer<typeof upsertAiIntegrationSchema>;

/** Tạo mask "sk-•••abc1" từ plaintext key. Chỉ giữ 4 ký tự cuối. */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "•••";
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}•••${suffix}`;
}
