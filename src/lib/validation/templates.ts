import { z } from "zod";

const trimmed = z.string().trim();

const TASK_PRIORITY = ["low", "medium", "high", "urgent"] as const;

/**
 * Form schema for creating or editing a service template (the parent row only).
 * Milestones / tasks / checklist items are managed via dedicated actions
 * once the template exists, so they don't need to be in this schema.
 */
export const createTemplateSchema = z.object({
  name: trimmed.min(2, "Tên template tối thiểu 2 ký tự").max(255),
  industry: trimmed.max(100),
  description: trimmed.max(2000),
  duration_days: z
    .number()
    .int("Thời lượng phải là số nguyên")
    .min(1, "Thời lượng tối thiểu 1 ngày")
    .max(3650, "Thời lượng tối đa 10 năm"),
  is_active: z.boolean(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const upsertMilestoneSchema = z.object({
  id: z.string().uuid().optional(),
  code: trimmed.max(20),
  title: trimmed.min(2, "Tiêu đề tối thiểu 2 ký tự").max(255),
  description: trimmed.max(1000),
  sort_order: z.number().int().min(0).default(0),
  offset_start_days: z
    .number()
    .int()
    .min(0, "Offset không âm")
    .max(3650),
  offset_end_days: z.number().int().min(0).max(3650),
  deliverable_required: z.boolean().default(false),
});

export type UpsertMilestoneInput = z.infer<typeof upsertMilestoneSchema>;

export const upsertTemplateTaskSchema = z.object({
  id: z.string().uuid().optional(),
  template_milestone_id: z.string().uuid().nullable(),
  title: trimmed.min(2, "Tiêu đề tối thiểu 2 ký tự").max(255),
  description: trimmed.max(1000),
  sort_order: z.number().int().min(0).default(0),
  default_role: trimmed.max(50),
  offset_days: z.number().int().min(0).max(3650),
  duration_days: z.number().int().min(1).max(365),
  priority: z.enum(TASK_PRIORITY),
  is_visible_to_customer: z.boolean().default(false),
});

export type UpsertTemplateTaskInput = z.infer<typeof upsertTemplateTaskSchema>;

export const upsertChecklistItemSchema = z.object({
  id: z.string().uuid().optional(),
  content: trimmed.min(1, "Nội dung không được để trống").max(500),
  sort_order: z.number().int().min(0).default(0),
});

export type UpsertChecklistItemInput = z.infer<
  typeof upsertChecklistItemSchema
>;

export function normalizeTemplateInput<T extends Partial<CreateTemplateInput>>(
  input: T,
): T {
  const out = { ...input } as Record<string, unknown>;
  for (const key of ["industry", "description"] as const) {
    if (key in out) {
      const v = out[key];
      out[key] = typeof v === "string" && v.length > 0 ? v : null;
    }
  }
  return out as T;
}
