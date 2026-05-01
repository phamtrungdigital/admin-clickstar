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
import { settingsSchema, type SettingsInput } from "@/lib/validation/settings";
import { updateSystemSettingsAction } from "@/app/(dashboard)/admin/settings/actions";
import { cn } from "@/lib/utils";

export type SettingsFormProps = {
  initial: SettingsInput;
  canEdit: boolean;
};

export function SettingsForm({ initial, canEdit }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial,
  });

  const onSubmit = (values: SettingsInput) => {
    startTransition(async () => {
      const result = await updateSystemSettingsAction(values);
      if (!result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            setError(k as keyof SettingsInput, { message: msg });
          }
        }
        return;
      }
      toast.success(
        result.data?.applied
          ? `Đã lưu ${result.data.applied} thay đổi`
          : "Không có gì thay đổi",
      );
      reset(values);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {!canEdit && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-600">
          Bạn đang xem ở chế độ chỉ đọc — chỉ <strong>Super Admin</strong> mới
          chỉnh được cài đặt.
        </div>
      )}

      <FormSection
        title="Thông tin tổ chức"
        description="Hiển thị trong PDF hợp đồng, email, footer và metadata trang."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tên tổ chức *" error={errors.orgName?.message}>
            <Input {...register("orgName")} disabled={!canEdit} />
          </Field>
          <Field label="Slogan / Tagline" error={errors.orgTagline?.message}>
            <Input {...register("orgTagline")} disabled={!canEdit} />
          </Field>
          <Field
            label="Email hỗ trợ"
            error={errors.orgSupportEmail?.message}
          >
            <Input
              type="email"
              {...register("orgSupportEmail")}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Mã số thuế" error={errors.orgTaxCode?.message}>
            <Input {...register("orgTaxCode")} disabled={!canEdit} />
          </Field>
          <Field
            label="Địa chỉ"
            error={errors.orgAddress?.message}
            className="md:col-span-2"
          >
            <Textarea {...register("orgAddress")} rows={2} disabled={!canEdit} />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Mặc định kinh doanh"
        description="Pre-fill khi tạo hợp đồng mới — vẫn override được cho từng hợp đồng."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="VAT mặc định (%)"
            error={errors.businessDefaultVat?.message}
          >
            <Controller
              control={control}
              name="businessDefaultVat"
              render={({ field }) => (
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={100}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(e.target.valueAsNumber || 0)
                  }
                  onBlur={field.onBlur}
                  disabled={!canEdit}
                />
              )}
            />
          </Field>
          <Field
            label="Đơn vị tiền tệ"
            error={errors.businessDefaultCurrency?.message}
          >
            <Input
              {...register("businessDefaultCurrency")}
              disabled={!canEdit}
              placeholder="VND"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Thông báo"
        description="Bật/tắt kênh gửi tự động cho thông báo hệ thống."
      >
        <div className="space-y-3">
          <Controller
            control={control}
            name="notificationsEmailEnabled"
            render={({ field }) => (
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                  disabled={!canEdit}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Gửi email thông báo
                  </p>
                  <p className="text-xs text-slate-500">
                    Sử dụng Resend để gửi email khi có ticket / cập nhật trạng
                    thái. Cần cấu hình{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                      RESEND_API_KEY
                    </code>{" "}
                    ở env.
                  </p>
                </div>
              </label>
            )}
          />
          <Controller
            control={control}
            name="notificationsZnsEnabled"
            render={({ field }) => (
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                  disabled={!canEdit}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Gửi tin Zalo (ZNS)
                  </p>
                  <p className="text-xs text-slate-500">
                    Cần cấu hình{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                      ZNS_API_BASE_URL
                    </code>{" "}
                    +{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                      ZNS_API_KEY
                    </code>{" "}
                    + OA ID.
                  </p>
                </div>
              </label>
            )}
          />
        </div>
      </FormSection>

      {canEdit && (
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={isPending || !isDirty}
          >
            Huỷ thay đổi
          </Button>
          <Button
            type="submit"
            disabled={isPending || !isDirty}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </div>
      )}
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
