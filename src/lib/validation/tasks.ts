import { z } from "zod";

const trimmed = z.string().trim();

const TASK_PRIORITY = ["low", "medium", "high", "urgent"] as const;
const EXTRA_SOURCE = ["internal", "customer", "risk"] as const;

/**
 * Schema for creating a task ad-hoc (outside of template fork). PM picks
 * project + optional milestone + assignee + reviewer + lifecycle metadata.
 */
export const createTaskSchema = z.object({
  project_id: z.string().uuid("Chọn dự án"),
  milestone_id: z.string().uuid().nullable(),
  title: trimmed.min(2, "Tiêu đề tối thiểu 2 ký tự").max(255),
  description: trimmed.max(2000),
  assignee_id: trimmed.max(40).nullable(),
  reviewer_id: trimmed.max(40).nullable(),
  due_at: trimmed.max(40), // ISO date or empty
  priority: z.enum(TASK_PRIORITY),
  is_visible_to_customer: z.boolean(),
  is_extra: z.boolean(),
  extra_source: z.enum(EXTRA_SOURCE).nullable(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Schemas for lifecycle transition actions. Most are zero-arg but a few
 * require a reason (block / return).
 */
export const blockTaskSchema = z.object({
  reason: trimmed.min(2, "Vui lòng nhập lý do bị chặn").max(2000),
});
export type BlockTaskInput = z.infer<typeof blockTaskSchema>;

export const returnTaskSchema = z.object({
  reason: trimmed.min(2, "Vui lòng nhập lý do trả về").max(2000),
});
export type ReturnTaskInput = z.infer<typeof returnTaskSchema>;

export const awaitingCustomerSchema = z.object({
  reason: trimmed.max(2000),
});
export type AwaitingCustomerInput = z.infer<typeof awaitingCustomerSchema>;

export const upsertTaskChecklistSchema = z.object({
  id: z.string().uuid().optional(),
  content: trimmed.min(1, "Nội dung không được để trống").max(500),
  sort_order: z.number().int().min(0).default(0),
});
export type UpsertTaskChecklistInput = z.infer<
  typeof upsertTaskChecklistSchema
>;

export const addTaskCommentSchema = z.object({
  body: trimmed.min(1, "Nội dung không được để trống").max(5000),
  is_internal: z.boolean(),
});
export type AddTaskCommentInput = z.infer<typeof addTaskCommentSchema>;

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "Mới tạo",
  assigned: "Đã giao",
  in_progress: "Đang làm",
  blocked: "Bị chặn",
  awaiting_customer: "Chờ phản hồi khách",
  awaiting_review: "Chờ duyệt",
  returned: "Trả về",
  done: "Hoàn thành",
  cancelled: "Đã huỷ",
};

export const TASK_PRIORITY_LABEL: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
};

export const EXTRA_SOURCE_LABEL: Record<string, string> = {
  internal: "Nội bộ",
  customer: "Từ khách",
  risk: "Rủi ro",
};
