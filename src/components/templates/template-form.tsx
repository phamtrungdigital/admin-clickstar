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
  createTemplateSchema,
  type CreateTemplateInput,
} from "@/lib/validation/templates";
import {
  createTemplateAndRedirect,
  updateTemplateAction,
} from "@/app/(dashboard)/templates/actions";
import { cn } from "@/lib/utils";

const INDUSTRY_SUGGESTIONS = ["SEO", "Ads", "Content", "Web", "Email", "Social"];

export type TemplateFormProps = {
  mode: "create" | "edit";
  templateId?: string;
  defaultValues?: Partial<CreateTemplateInput>;
};

export function TemplateForm({
  mode,
  templateId,
  defaultValues,
}: TemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      industry: defaultValues?.industry ?? "",
      description: defaultValues?.description ?? "",
      duration_days: defaultValues?.duration_days ?? 90,
      is_active: defaultValues?.is_active ?? true,
    },
  });

  const onSubmit = (values: CreateTemplateInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTemplateAndRedirect(values)
          : await updateTemplateAction(templateId!, values);

      if (result && !result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [key, msg] of Object.entries(result.fieldErrors)) {
            setError(key as keyof CreateTemplateInput, { message: msg });
          }
        }
        return;
      }
      if (mode === "edit") {
        toast.success("Đã cập nhật template");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <Label className="text-sm font-medium text-slate-700">Tên template *</Label>
          <Input
            className={cn("mt-1.5", errors.name && "border-red-500")}
            placeholder="VD: SEO 6 tháng chuẩn"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-sm font-medium text-slate-700">Ngành dịch vụ</Label>
            <Input
              list="industries"
              className="mt-1.5"
              placeholder="VD: SEO"
              {...register("industry")}
            />
            <datalist id="industries">
              {INDUSTRY_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">Thời lượng chuẩn (ngày) *</Label>
            <Controller
              control={control}
              name="duration_days"
              render={({ field }) => (
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  className={cn("mt-1.5", errors.duration_days && "border-red-500")}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(e.target.valueAsNumber || 1)
                  }
                />
              )}
            />
            {errors.duration_days && (
              <p className="mt-1 text-xs text-red-600">
                {errors.duration_days.message}
              </p>
            )}
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700">Mô tả</Label>
          <Textarea
            rows={3}
            className="mt-1.5"
            placeholder="Mô tả ngắn gọn dịch vụ template này áp dụng cho ai, kịch bản nào."
            {...register("description")}
          />
        </div>
        <div className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-4 py-3">
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={(c) => field.onChange(c === true)}
                id="is-active"
              />
            )}
          />
          <Label htmlFor="is-active" className="text-sm text-slate-700">
            Đang dùng — template hiển thị khi chọn cho hợp đồng mới
          </Label>
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
          {mode === "create" ? "Tạo template" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
