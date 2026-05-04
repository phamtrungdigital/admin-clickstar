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

const milestoneAttachmentSchema = z.object({
  path: z.string().min(1),
  filename: z.string().min(1),
  content_type: z.string().min(1),
  size: z.number().int().nonnegative(),
});

const milestoneLinkSchema = z.object({
  url: z
    .string()
    .url("URL không hợp lệ")
    .max(2000, "URL quá dài"),
  label: z.string().trim().max(200).optional(),
});

export const completeMilestoneSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(10, "Mô tả nghiệm thu cần ít nhất 10 ký tự")
      .max(5000, "Mô tả không quá 5000 ký tự"),
    attachments: z.array(milestoneAttachmentSchema).default([]),
    links: z.array(milestoneLinkSchema).default([]),
  })
  .refine(
    (data) => data.attachments.length + data.links.length >= 1,
    {
      message: "Cần đính kèm ít nhất 1 file hoặc 1 link làm bằng chứng",
      path: ["attachments"],
    },
  );

export type CompleteMilestoneInput = z.infer<typeof completeMilestoneSchema>;

export const reopenMilestoneSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Cần nhập lý do mở lại (ít nhất 5 ký tự)")
    .max(1000),
});

export type ReopenMilestoneInput = z.infer<typeof reopenMilestoneSchema>;

/** Số phút sau khi báo hoàn thành mà nhân viên còn được "Hoàn tác" */
export const UNDO_WINDOW_MINUTES = 5;
