"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSection } from "@/components/ui/form-section";
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
  COMPANY_STATUS_OPTIONS,
  createCompanySchema,
  type CreateCompanyInput,
} from "@/lib/validation/companies";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/app/(dashboard)/customers/actions";
import { cn } from "@/lib/utils";

const NO_MANAGER = "__none__";

export type ServicePickOption = {
  id: string;
  name: string;
  category: string | null;
  code: string | null;
};

export type CustomerFormProps = {
  mode: "create" | "edit";
  customerId?: string;
  defaultValues?: Partial<CreateCompanyInput>;
  staff: Array<{ id: string; full_name: string; internal_role: string | null }>;
  services: ServicePickOption[];
  /** Current user id — used as the default Account Manager when the user
   *  doesn't have manager+ rights to pick someone else. */
  currentUserId: string;
  /** Manager / admin / super_admin can pick any AM. Staff / support /
   *  accountant get the field locked to themselves. */
  canChooseManager: boolean;
};

export function CustomerForm({
  mode,
  customerId,
  defaultValues,
  staff,
  services,
  currentUserId,
  canChooseManager,
}: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      code: defaultValues?.code ?? "",
      status: defaultValues?.status ?? "new",
      industry: defaultValues?.industry ?? "",
      website: defaultValues?.website ?? "",
      representative: defaultValues?.representative ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      address: defaultValues?.address ?? "",
      tax_code: defaultValues?.tax_code ?? "",
      // Auto-fill the AM with the current user when nothing is set yet.
      // Manager+ can change it freely; staff/support/accountant get the
      // dropdown locked below.
      primary_account_manager_id:
        defaultValues?.primary_account_manager_id ?? currentUserId,
      service_ids: defaultValues?.service_ids ?? [],
    },
  });

  const onSubmit = (values: CreateCompanyInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCustomerAction(values)
          : await updateCustomerAction(customerId!, values);

      if (!result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [key, msg] of Object.entries(result.fieldErrors)) {
            setError(key as keyof CreateCompanyInput, { message: msg });
          }
        }
        return;
      }

      toast.success(mode === "create" ? "Đã tạo khách hàng" : "Đã cập nhật");
      const redirectId = mode === "create" ? result.data?.id : customerId;
      if (redirectId) {
        router.push(`/customers/${redirectId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Thông tin doanh nghiệp" description="Thông tin định danh chính của khách hàng.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tên doanh nghiệp *" error={errors.name?.message}>
            <Input
              {...register("name")}
              placeholder="VD: Công ty TNHH ABC"
              autoComplete="organization"
            />
          </Field>
          <Field label="Mã khách hàng" error={errors.code?.message}>
            <Input {...register("code")} placeholder="Tự động sinh nếu để trống" />
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
                          COMPANY_STATUS_OPTIONS.find((o) => o.value === value)
                            ?.label ?? value
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Ngành nghề" error={errors.industry?.message}>
            <Input {...register("industry")} placeholder="VD: Thương mại điện tử" />
          </Field>
          <Field label="Người đại diện" error={errors.representative?.message}>
            <Input
              {...register("representative")}
              placeholder="Họ tên người liên hệ chính"
              autoComplete="name"
            />
          </Field>
          <Field label="Mã số thuế" error={errors.tax_code?.message}>
            <Input {...register("tax_code")} placeholder="0312345678" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Liên hệ" description="Thông tin liên hệ chính của khách hàng.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email *" error={errors.email?.message}>
            <Input
              type="email"
              {...register("email")}
              placeholder="contact@khachhang.com"
              autoComplete="email"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Bắt buộc — hệ thống sẽ tự tạo tài khoản portal cho khách + gửi
              email chào mừng kèm thông tin đăng nhập.
            </p>
          </Field>
          <Field label="Số điện thoại" error={errors.phone?.message}>
            <Input
              {...register("phone")}
              placeholder="0987 654 321"
              autoComplete="tel"
            />
          </Field>
          <Field label="Website" error={errors.website?.message}>
            <Input
              {...register("website")}
              placeholder="https://khachhang.com"
              autoComplete="url"
            />
          </Field>
          <Field label="Địa chỉ" error={errors.address?.message} className="md:col-span-2">
            <Textarea
              {...register("address")}
              rows={2}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Dịch vụ sử dụng"
        description="Khách hàng có thể dùng nhiều dịch vụ — tích chọn các dịch vụ Clickstar đang/sẽ cung cấp."
      >
        <Controller
          control={control}
          name="service_ids"
          render={({ field }) => (
            <ServiceCheckboxGrid
              services={services}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <FormSection title="Phụ trách" description="Người chịu trách nhiệm chính cho tài khoản này từ phía Clickstar.">
        <Field
          label="Account Manager chính"
          error={errors.primary_account_manager_id?.message}
        >
          <Controller
            control={control}
            name="primary_account_manager_id"
            render={({ field }) => (
              <Select
                value={field.value ?? NO_MANAGER}
                onValueChange={(v) => field.onChange(v === NO_MANAGER ? null : v)}
                disabled={!canChooseManager}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Chưa phân công">
                    {(value: string | null) => {
                      if (!value || value === NO_MANAGER) return "Chưa phân công";
                      const member = staff.find((s) => s.id === value);
                      return member?.full_name || "(chưa đặt tên)";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>Chưa phân công</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || "(chưa đặt tên)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {!canChooseManager && (
            <p className="mt-1.5 text-xs text-slate-500">
              Bạn được mặc định là Account Manager của khách hàng này. Nếu cần
              chuyển người phụ trách, hãy liên hệ Manager hoặc Admin.
            </p>
          )}
        </Field>
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
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Tạo khách hàng" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
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

const UNCATEGORIZED = "Chưa phân loại";

function ServiceCheckboxGrid({
  services,
  value,
  onChange,
}: {
  services: ServicePickOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  if (services.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
        Chưa có dịch vụ nào trong catalog. Thêm dịch vụ tại{" "}
        <Link
          className="font-medium text-blue-600 hover:underline"
          href="/services"
        >
          Dịch vụ
        </Link>{" "}
        rồi quay lại tích chọn.
      </div>
    );
  }

  const grouped = new Map<string, ServicePickOption[]>();
  for (const s of services) {
    const key = s.category || UNCATEGORIZED;
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }
  const selected = new Set(value);

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="space-y-5">
      {[...grouped.entries()].map(([category, items]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {category}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => {
              const checked = selected.has(s.id);
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm transition-colors",
                    checked
                      ? "border-blue-300 bg-blue-50/50"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(s.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    {s.code && (
                      <p className="font-mono text-[11px] text-slate-500">
                        {s.code}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
