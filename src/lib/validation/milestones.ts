import { z } from "zod";

export const MILESTONE_STATUS_OPTIONS = [
  { value: "not_started", label: "Sắp tới" },
  { value: "active", label: "Đang thực hiện" },
  { value: "awaiting_customer", label: "Chờ phản hồi" },
  { value: "awaiting_review", label: "Chờ duyệt" },
  { value: "completed", label: "Đã hoàn thành" },
  { value: "paused", label: "Tạm dừng" },
] as const;

export const updateMilestoneSchema = z.object({
  title: z.string().trim().min(1, "Tên milestone không được trống").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum([
    "not_started",
    "active",
    "awaiting_customer",
    "awaiting_review",
    "completed",
    "paused",
  ]),
  progress_percent: z
    .number()
    .int()
    .min(0, "Tiến độ phải >= 0")
    .max(100, "Tiến độ phải <= 100"),
  starts_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sai định dạng ngày")
    .optional()
    .nullable(),
  ends_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sai định dạng ngày")
    .optional()
    .nullable(),
});

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export const addMilestoneCommentSchema = z.object({
  milestone_id: z.string().uuid(),
  body: z.string().trim().min(1, "Nội dung không được trống").max(5000),
});

export type AddMilestoneCommentInput = z.infer<typeof addMilestoneCommentSchema>;
