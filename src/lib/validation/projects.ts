import { z } from "zod";

const trimmed = z.string().trim();

export const SCHEDULING_MODE_OPTIONS = [
  {
    value: "auto",
    label: "Tự động (theo template)",
    hint: "Tính ngày từ ngày bắt đầu + offset của template. Phù hợp dự án có deadline cố định.",
  },
  {
    value: "manual",
    label: "Linh hoạt (PM tự đặt)",
    hint: "Copy cấu trúc, không tự sinh ngày. PM/staff sẽ set deadline cho từng giai đoạn khi tiến hành.",
  },
  {
    value: "rolling",
    label: "Vận hành liên tục (retainer)",
    hint: "Dự án ongoing không có deadline cuối. Khách thấy danh sách công việc theo status thay vì timeline.",
  },
] as const;

export const schedulingModeSchema = z.enum(["auto", "manual", "rolling"]);

export const forkProjectSchema = z
  .object({
    contract_id: z.string().uuid("Hợp đồng không hợp lệ"),
    template_id: z.string().uuid("Chọn template"),
    name: trimmed.min(2, "Tên dự án tối thiểu 2 ký tự").max(255),
    starts_at: trimmed.max(20).optional().default(""),
    pm_id: trimmed.max(40).nullable(),
    scheduling_mode: schedulingModeSchema.default("auto"),
  })
  .refine(
    (data) =>
      data.scheduling_mode !== "auto" || data.starts_at.trim().length >= 8,
    {
      message: "Chế độ Tự động cần ngày bắt đầu",
      path: ["starts_at"],
    },
  );

export type ForkProjectInput = z.infer<typeof forkProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: trimmed.min(2).max(255),
    description: trimmed.max(2000),
    starts_at: trimmed.max(20),
    ends_at: trimmed.max(20),
    pm_id: trimmed.max(40).nullable(),
    progress_percent: z.number().int().min(0).max(100),
    scheduling_mode: schedulingModeSchema,
  })
  .partial();

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
