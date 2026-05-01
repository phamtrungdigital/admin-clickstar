"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
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
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  createTicketSchema,
  type CreateTicketInput,
} from "@/lib/validation/tickets";
import {
  createTicketAction,
  updateTicketAction,
} from "@/app/(dashboard)/tickets/actions";
import { TicketAttachmentsField } from "./ticket-attachments-field";
import { cn } from "@/lib/utils";

const NO_ASSIGNEE = "__none__";

export type TicketFormProps = {
  mode: "create" | "edit";
  ticketId?: string;
  defaultValues?: Partial<CreateTicketInput>;
  companies: Array<{ id: string; name: string; code: string | null }>;
  staff: Array<{ id: string; full_name: string; internal_role: string | null }>;
};

export function TicketForm({
  mode,
  ticketId,
  defaultValues,
  companies,
  staff,
}: TicketFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      code: defaultValues?.code ?? "",
      company_id: defaultValues?.company_id ?? "",
      description: defaultValues?.description ?? "",
      priority: defaultValues?.priority ?? "medium",
      status: defaultValues?.status ?? "new",
      assignee_id: defaultValues?.assignee_id ?? null,
      attachments: defaultValues?.attachments ?? [],
    },
  });

  const watchedCompanyId = useWatch({ control, name: "company_id" });

  const onSubmit = (values: CreateTicketInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTicketAction(values)
          : await updateTicketAction(ticketId!, values);

      if (!result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [key, msg] of Object.entries(result.fieldErrors)) {
            setError(key as keyof CreateTicketInput, { message: msg });
          }
        }
        return;
      }

      toast.success(mode === "create" ? "Đã tạo ticket" : "Đã cập nhật");
      const redirectId = mode === "create" ? result.data?.id : ticketId;
      if (redirectId) {
        router.push(`/tickets/${redirectId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection
        title="Thông tin ticket"
        description="Mô tả vấn đề khách hàng đang gặp và mức độ ưu tiên xử lý."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Tiêu đề *"
            error={errors.title?.message}
            className="md:col-span-2"
          >
            <Input
              {...register("title")}
              placeholder="VD: Website lỗi không load được trang chủ"
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
          <Field label="Mã ticket" error={errors.code?.message}>
            <Input
              {...register("code")}
              placeholder="Tự động hoặc nhập thủ công, VD: TKT-2026-0001"
            />
          </Field>
          <Field
            label="Mô tả chi tiết"
            error={errors.description?.message}
            className="md:col-span-2"
          >
            <Textarea
              {...register("description")}
              rows={5}
              placeholder="Mô tả các bước tái hiện, expected vs actual..."
            />
          </Field>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Tệp đính kèm
            </Label>
            <Controller
              control={control}
              name="attachments"
              render={({ field }) => (
                <TicketAttachmentsField
                  companyId={watchedCompanyId || null}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Phân loại & phân công"
        description="Thiết lập độ ưu tiên, trạng thái xử lý và người phụ trách."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Mức ưu tiên *" error={errors.priority?.message}>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn mức ưu tiên">
                      {(value: string | null) => {
                        if (!value) return null;
                        return (
                          TICKET_PRIORITY_OPTIONS.find((o) => o.value === value)
                            ?.label ?? value
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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
                          TICKET_STATUS_OPTIONS.find((o) => o.value === value)
                            ?.label ?? value
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Người phụ trách" error={errors.assignee_id?.message}>
            <Controller
              control={control}
              name="assignee_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_ASSIGNEE}
                  onValueChange={(v) =>
                    field.onChange(v === NO_ASSIGNEE ? null : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chưa phân công">
                      {(value: string | null) => {
                        if (!value || value === NO_ASSIGNEE)
                          return "Chưa phân công";
                        const m = staff.find((s) => s.id === value);
                        return m?.full_name || "(chưa đặt tên)";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ASSIGNEE}>Chưa phân công</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name || "(chưa đặt tên)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
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
          {mode === "create" ? "Tạo ticket" : "Lưu thay đổi"}
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
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
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
