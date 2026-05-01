import { z } from "zod";

const trimmed = z.string().trim();

const SNAPSHOT_TYPE = ["weekly", "milestone", "deliverable", "extra_task"] as const;

export const createSnapshotSchema = z.object({
  project_id: z.string().uuid("Dự án không hợp lệ"),
  type: z.enum(SNAPSHOT_TYPE),
  notes: trimmed.max(2000),
});

export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>;

export const approveSnapshotSchema = z.object({
  comment: trimmed.max(2000),
});

export type ApproveSnapshotInput = z.infer<typeof approveSnapshotSchema>;

export const rejectSnapshotSchema = z.object({
  reason: trimmed.min(2, "Vui lòng nhập lý do từ chối").max(2000),
});

export type RejectSnapshotInput = z.infer<typeof rejectSnapshotSchema>;

export const rollbackSnapshotSchema = z.object({
  reason: trimmed.min(2, "Vui lòng nhập lý do rollback").max(2000),
});

export type RollbackSnapshotInput = z.infer<typeof rollbackSnapshotSchema>;

export const SNAPSHOT_TYPE_LABEL: Record<(typeof SNAPSHOT_TYPE)[number], string> = {
  weekly: "Cập nhật tuần",
  milestone: "Hoàn thành milestone",
  deliverable: "Bàn giao sản phẩm",
  extra_task: "Task phát sinh",
};

export const SNAPSHOT_TYPE_DESCRIPTION: Record<
  (typeof SNAPSHOT_TYPE)[number],
  string
> = {
  weekly:
    "Snapshot tuần định kỳ — auto-publish sau 24h nếu admin không phản hồi.",
  milestone:
    "Milestone vừa được hoàn thành — bắt buộc admin duyệt thủ công.",
  deliverable:
    "Có sản phẩm bàn giao mới — bắt buộc admin duyệt thủ công.",
  extra_task:
    "Task phát sinh ngoài kế hoạch — bắt buộc admin duyệt thủ công.",
};
