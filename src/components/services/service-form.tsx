"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  BILLING_CYCLE_SUGGESTIONS,
  SERVICE_CATEGORY_SUGGESTIONS,
  createServiceSchema,
  type CreateServiceInput,
} from "@/lib/validation/services";
import {
  createServiceAction,
  updateServiceAction,
} from "@/app/(dashboard)/services/actions";
import { cn } from "@/lib/utils";

const NO_VALUE = "__none__";

export type ServiceFormProps = {
  mode: "create" | "edit";
  serviceId?: string;
  defaultValues?: Partial<CreateServiceInput>;
};

export function ServiceForm({ mode, serviceId, defaultValues }: ServiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      code: defaultValues?.code ?? "",
      category: defaultValues?.category ?? "",
      description: defaultValues?.description ?? "",
      default_price: defaultValues?.default_price ?? 0,
      billing_cycle: defaultValues?.billing_cycle ?? "",
      is_active: defaultValues?.is_active ?? true,
    },
  });

  const onSubmit = (values: CreateServiceInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createServiceAction(values)
          : await updateServiceAction(serviceId!, values);

      if (!result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [key, msg] of Object.entries(result.fieldErrors)) {
            setError(key as keyof CreateServiceInput, { message: msg });
          }
        }
        return;
      }

      toast.success(mode === "create" ? "Đã thêm dịch vụ" : "Đã cập nhật");
      const redirectId = mode === "create" ? result.data?.id : serviceId;
      if (redirectId) {
        router.push(`/services/${redirectId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection
        title="Thông tin dịch vụ"
        description="Thông tin cơ bản hiển thị trong danh sách dịch vụ."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Tên dịch vụ *"
            error={errors.name?.message}
            className="md:col-span-2"
          >
            <Input
              {...register("name")}
              placeholder="VD: Thiết kế website doanh nghiệp"
            />
          </Field>
          <Field label="Mã dịch vụ" error={errors.code?.message}>
            <Input {...register("code")} placeholder="VD: WEB-001" />
          </Field>
          <Field label="Danh mục" error={errors.category?.message}>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value ? field.value : NO_VALUE}
                  onValueChange={(v) => field.onChange(v === NO_VALUE ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>Không phân loại</SelectItem>
                    {SERVICE_CATEGORY_SUGGESTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Mô tả" error={errors.description?.message} className="md:col-span-2">
            <Textarea
              {...register("description")}
              rows={3}
              placeholder="Mô tả ngắn về phạm vi dịch vụ, đối tượng khách phù hợp, ..."
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Giá & chu kỳ thanh toán"
        description="Mức giá gợi ý và chu kỳ mặc định khi gắn dịch vụ vào hợp đồng."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Giá mặc định (VND)"
            error={errors.default_price?.message}
          >
            <Controller
              control={control}
              name="default_price"
              render={({ field }) => (
                <Input
                  type="number"
                  inputMode="numeric"
                  step="1000"
                  min={0}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(e.target.valueAsNumber || 0)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
            <p className="text-xs text-slate-500">
              Để 0 nếu báo giá theo từng dự án.
            </p>
          </Field>
          <Field label="Chu kỳ" error={errors.billing_cycle?.message}>
            <Controller
              control={control}
              name="billing_cycle"
              render={({ field }) => (
                <Select
                  value={field.value ? field.value : NO_VALUE}
                  onValueChange={(v) => field.onChange(v === NO_VALUE ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn chu kỳ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>Không cố định</SelectItem>
                    {BILLING_CYCLE_SUGGESTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Trạng thái">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <Checkbox
            checked={watch("is_active")}
            onCheckedChange={(c) => setValue("is_active", c === true)}
          />
          <div>
            <p className="text-sm font-medium text-slate-900">
              Đang cung cấp dịch vụ này
            </p>
            <p className="text-xs text-slate-500">
              Bỏ tick nếu Clickstar tạm ngưng cung cấp dịch vụ. Dịch vụ tạm
              ngưng vẫn hiển thị nhưng không xuất hiện trong dropdown chọn dịch
              vụ khi tạo hợp đồng mới.
            </p>
          </div>
        </label>
      </FormSection>

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
          {mode === "create" ? "Tạo dịch vụ" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
