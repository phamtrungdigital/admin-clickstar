import { z } from "zod";

const trimmed = z.string().trim();

export const forkProjectSchema = z.object({
  contract_id: z.string().uuid("Hợp đồng không hợp lệ"),
  template_id: z.string().uuid("Chọn template"),
  name: trimmed.min(2, "Tên dự án tối thiểu 2 ký tự").max(255),
  starts_at: trimmed
    .min(8, "Chọn ngày bắt đầu")
    .max(20),
  pm_id: trimmed.max(40).nullable(),
});

export type ForkProjectInput = z.infer<typeof forkProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: trimmed.min(2).max(255),
    description: trimmed.max(2000),
    starts_at: trimmed.max(20),
    ends_at: trimmed.max(20),
    pm_id: trimmed.max(40).nullable(),
    progress_percent: z.number().int().min(0).max(100),
  })
  .partial();

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
