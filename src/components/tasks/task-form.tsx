"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createTaskAction,
  updateTaskAction,
} from "@/app/(dashboard)/tasks/actions";
import {
  EXTRA_SOURCE_LABEL,
  TASK_PRIORITY_LABEL,
  createTaskSchema,
  type CreateTaskInput,
} from "@/lib/validation/tasks";

export type ProjectOption = {
  id: string;
  name: string;
  company_name: string | null;
};

export type MilestoneOption = {
  id: string;
  project_id: string;
  code: string | null;
  title: string;
};

export type StaffOption = {
  id: string;
  full_name: string;
};

export type TaskFormProps = {
  mode: "create" | "edit";
  taskId?: string;
  defaultValues?: Partial<CreateTaskInput>;
  projects: ProjectOption[];
  milestones: MilestoneOption[];
  staff: StaffOption[];
};

const PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;
const EXTRA_SOURCE_VALUES = ["internal", "customer", "risk"] as const;

export function TaskForm({
  mode,
  taskId,
  defaultValues,
  projects,
  milestones,
  staff,
}: TaskFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      project_id: defaultValues?.project_id ?? "",
      milestone_id: defaultValues?.milestone_id ?? null,
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      assignee_id: defaultValues?.assignee_id ?? null,
      reviewer_id: defaultValues?.reviewer_id ?? null,
      due_at: defaultValues?.due_at ?? "",
      priority: defaultValues?.priority ?? "medium",
      is_visible_to_customer: defaultValues?.is_visible_to_customer ?? false,
      is_extra: defaultValues?.is_extra ?? false,
      extra_source: defaultValues?.extra_source ?? null,
    },
  });

  const watchedProjectId = watch("project_id");
  const watchedIsExtra = watch("is_extra");
  const filteredMilestones = milestones.filter(
    (m) => m.project_id === watchedProjectId,
  );

  const onSubmit = (values: CreateTaskInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTaskAction(values)
          : await updateTaskAction(taskId!, values);
      if (!result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [k, m] of Object.entries(result.fieldErrors)) {
            setError(k as keyof CreateTaskInput, { message: m });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Đã tạo task" : "Đã cập nhật");
      const redirectId =
        mode === "create" && "data" in result ? result.data?.id : taskId;
      if (redirectId) router.push(`/tasks/${redirectId}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <Label className="text-sm font-medium text-slate-700">Tiêu đề *</Label>
          <Input
            className={cn("mt-1.5", errors.title && "border-red-500")}
            placeholder="VD: Tối ưu Title & Meta cho 50 trang sản phẩm"
            {...register("title")}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
          )}
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700">Mô tả</Label>
          <Textarea
            rows={4}
            className="mt-1.5"
            placeholder="Mô tả chi tiết yêu cầu, deliverable mong đợi, link tài liệu liên quan."
            {...register("description")}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-sm font-medium text-slate-700">Dự án *</Label>
            <Controller
              control={control}
              name="project_id"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={(v) => v && field.onChange(v)}>
                  <SelectTrigger className={cn("mt-1.5 w-full", errors.project_id && "border-red-500")}>
                    <SelectValue placeholder="Chọn dự án">
                      {(value: string | null) => {
                        if (!value) return null;
                        const p = projects.find((x) => x.id === value);
                        return p ? p.name : value;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.company_name ? ` · ${p.company_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.project_id && (
              <p className="mt-1 text-xs text-red-600">
                {errors.project_id.message}
              </p>
            )}
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Milestone
            </Label>
            <Controller
              control={control}
              name="milestone_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) =>
                    field.onChange(!v || v === "none" ? null : v)
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue placeholder="Không gán milestone">
                      {(value: string | null) => {
                        if (!value || value === "none") return "Không gán milestone";
                        const m = milestones.find((x) => x.id === value);
                        return m
                          ? `${m.code ? `${m.code} · ` : ""}${m.title}`
                          : value;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không gán milestone</SelectItem>
                    {filteredMilestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.code ? `${m.code} · ` : ""}
                        {m.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {filteredMilestones.length === 0 && watchedProjectId && (
              <p className="mt-1 text-xs text-slate-500">
                Dự án này chưa có milestone nào.
              </p>
            )}
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Người phụ trách
            </Label>
            <StaffPicker name="assignee_id" control={control} staff={staff} />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Reviewer
            </Label>
            <StaffPicker name="reviewer_id" control={control} staff={staff} />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Deadline
            </Label>
            <Input
              type="datetime-local"
              className="mt-1.5"
              {...register("due_at")}
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Độ ưu tiên *
            </Label>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        value
                          ? TASK_PRIORITY_LABEL[value] ?? value
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_VALUES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {TASK_PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50/60 p-4">
          <Controller
            control={control}
            name="is_visible_to_customer"
            render={({ field }) => (
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                />
                <span className="text-sm text-slate-700">
                  Khách hàng thấy task này (qua snapshot đã duyệt)
                </span>
              </label>
            )}
          />
          <Controller
            control={control}
            name="is_extra"
            render={({ field }) => (
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                />
                <span className="text-sm text-slate-700">
                  Task phát sinh (ngoài kế hoạch template)
                </span>
              </label>
            )}
          />
          {watchedIsExtra && (
            <div>
              <Label className="text-xs text-slate-500">
                Nguồn phát sinh
              </Label>
              <Controller
                control={control}
                name="extra_source"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "internal"}
                    onValueChange={(v) =>
                      field.onChange((v ?? "internal") as CreateTaskInput["extra_source"])
                    }
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue>
                        {(value: string | null) =>
                          value
                            ? EXTRA_SOURCE_LABEL[value] ?? value
                            : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EXTRA_SOURCE_VALUES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {EXTRA_SOURCE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Huỷ
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Tạo task" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

function StaffPicker({
  name,
  control,
  staff,
}: {
  name: "assignee_id" | "reviewer_id";
  control: import("react-hook-form").Control<CreateTaskInput>;
  staff: StaffOption[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={field.value ?? "none"}
          onValueChange={(v) => field.onChange(!v || v === "none" ? null : v)}
        >
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue placeholder="(chưa gán)">
              {(value: string | null) => {
                if (!value || value === "none") return "(chưa gán)";
                const s = staff.find((x) => x.id === value);
                return s?.full_name ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">(chưa gán)</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
