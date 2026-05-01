import { z } from "zod";

const trimmed = z.string().trim();

export const upsertReportSchema = z.object({
  project_id: z.string().uuid("Chọn dự án"),
  title: trimmed.min(2, "Tiêu đề tối thiểu 2 ký tự").max(255),
  description: trimmed.max(500),
  period_start: trimmed.max(20),
  period_end: trimmed.max(20),
  content: trimmed.min(10, "Báo cáo phải có ít nhất 10 ký tự").max(50000),
});
export type UpsertReportInput = z.infer<typeof upsertReportSchema>;

export const approveReportSchema = z.object({
  comment: trimmed.max(2000),
});
export type ApproveReportInput = z.infer<typeof approveReportSchema>;

export const rejectReportSchema = z.object({
  reason: trimmed.min(2, "Vui lòng nhập lý do từ chối").max(2000),
});
export type RejectReportInput = z.infer<typeof rejectReportSchema>;

export const REPORT_STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  pending_approval: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
};
