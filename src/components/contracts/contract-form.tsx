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
import {
  CONTRACT_STATUS_OPTIONS,
  createContractSchema,
  type CreateContractInput,
} from "@/lib/validation/contracts";
import {
  createContractAction,
  updateContractAction,
} from "@/app/(dashboard)/contracts/actions";
import type { ServiceOption } from "@/lib/queries/contracts";
import { ContractServicesEditor } from "./contract-services-editor";
import { ContractAttachmentField } from "./contract-attachment-field";
import { cn } from "@/lib/utils";

export type ContractFormProps = {
  mode: "create" | "edit";
  contractId?: string;
  defaultValues?: Partial<CreateContractInput>;
  companies: Array<{ id: string; name: string; code: string | null }>;
  services: ServiceOption[];
};

export function ContractForm({
  mode,
  contractId,
  defaultValues,
  companies,
  services,
}: ContractFormProps) {
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
  } = useForm<CreateContractInput>({
    resolver: zodResolver(createContractSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      code: defaultValues?.code ?? "",
      company_id: defaultValues?.company_id ?? "",
      status: defaultValues?.status ?? "draft",
      total_value: defaultValues?.total_value ?? 0,
      currency: defaultValues?.currency ?? "VND",
      vat_percent: defaultValues?.vat_percent ?? 8,
      signed_at: defaultValues?.signed_at ?? "",
      starts_at: defaultValues?.starts_at ?? "",
      ends_at: defaultValues?.ends_at ?? "",
      notes: defaultValues?.notes ?? "",
      attachment_url: defaultValues?.attachment_url ?? "",
      attachment_filename: defaultValues?.attachment_filename ?? "",
      services: defaultValues?.services ?? [],
    },
  });

  const companyId = watch("company_id");
  const servicesValue = watch("services");

  const computedTotal = (servicesValue ?? []).reduce(
    (sum, s) => sum + (s.unit_price || 0) * (s.quantity || 0),
    0,
  );

  const onSubmit = (values: CreateContractInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createContractAction(values)
          : await updateContractAction(contractId!, values);

      if (!result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [key, msg] of Object.entries(result.fieldErrors)) {
            setError(key as keyof CreateContractInput, { message: msg });
          }
        }
        return;
      }

      toast.success(mode === "create" ? "Đã tạo hợp đồng" : "Đã cập nhật");
      const redirectId = mode === "create" ? result.data?.id : contractId;
      if (redirectId) {
        router.push(`/contracts/${redirectId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection
        title="Thông tin hợp đồng"
        description="Khách hàng, mã, trạng thái và các mốc thời gian."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Tên hợp đồng *"
            error={errors.name?.message}
            className="md:col-span-2"
          >
            <Input
              {...register("name")}
              placeholder="VD: Hợp đồng triển khai Marketing 2026"
            />
          </Field>
          <Field label="Khách hàng *" error={errors.company_id?.message}>
            <Controller
              control={control}
              name="company_id"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn khách hàng">
                      {(value: string | null) => {
                        if (!value) return null;
                        const c = companies.find((co) => co.id === value);
                        if (!c) return value;
                        return c.code ? `${c.name} · ${c.code}` : c.name;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.code ? ` · ${c.code}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Mã hợp đồng" error={errors.code?.message}>
            <Input {...register("code")} placeholder="VD: HD-2026-001" />
          </Field>
          <Field label="Trạng thái *" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn trạng thái">
                      {(value: string | null) => {
                        if (!value) return null;
                        return (
                          CONTRACT_STATUS_OPTIONS.find((o) => o.value === value)
                            ?.label ?? value
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Ngày ký" error={errors.signed_at?.message}>
            <Input type="date" {...register("signed_at")} />
          </Field>
          <Field label="Ngày bắt đầu" error={errors.starts_at?.message}>
            <Input type="date" {...register("starts_at")} />
          </Field>
          <Field label="Ngày kết thúc" error={errors.ends_at?.message}>
            <Input type="date" {...register("ends_at")} />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Dịch vụ trong hợp đồng"
        description="Các dịch vụ Clickstar cung cấp theo hợp đồng này."
      >
        <Controller
          control={control}
          name="services"
          render={({ field }) => (
            <ContractServicesEditor
              services={field.value ?? []}
              options={services}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <FormSection
        title="Giá trị & VAT"
        description="Có thể đồng bộ tổng giá trị từ tổng tạm tính của các dịch vụ ở trên."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tổng giá trị (VND)" error={errors.total_value?.message}>
            <Controller
              control={control}
              name="total_value"
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
            {computedTotal > 0 && (
              <button
                type="button"
                onClick={() => setValue("total_value", computedTotal)}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Lấy từ dịch vụ ({computedTotal.toLocaleString("vi-VN")} ₫)
              </button>
            )}
          </Field>
          <Field label="VAT (%)" error={errors.vat_percent?.message}>
            <Controller
              control={control}
              name="vat_percent"
              render={({ field }) => (
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(e.target.valueAsNumber || 0)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field label="Đơn vị tiền tệ" error={errors.currency?.message}>
            <Input {...register("currency")} placeholder="VND" />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Tệp đính kèm"
        description="Upload bản hợp đồng PDF lên Storage hoặc dán link Google Drive / Dropbox."
      >
        <Controller
          control={control}
          name="attachment_url"
          render={({ field }) => (
            <Controller
              control={control}
              name="attachment_filename"
              render={({ field: fileField }) => (
                <ContractAttachmentField
                  companyId={companyId || null}
                  value={{
                    url: field.value ?? "",
                    filename: fileField.value ?? "",
                  }}
                  onChange={({ url, filename }) => {
                    field.onChange(url);
                    fileField.onChange(filename);
                  }}
                />
              )}
            />
          )}
        />
      </FormSection>

      <FormSection title="Ghi chú">
        <Textarea
          {...register("notes")}
          rows={3}
          placeholder="Ghi chú nội bộ về hợp đồng này (không hiển thị cho khách hàng)."
        />
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
          {mode === "create" ? "Tạo hợp đồng" : "Lưu thay đổi"}
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
