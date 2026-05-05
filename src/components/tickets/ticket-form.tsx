"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  createTicketSchema,
  type CreateTicketInput,
} from "@/lib/validation/tickets";
import {
  createTicketAction,
  updateTicketAction,
} from "@/app/(dashboard)/tickets/actions";
import {
  TicketAttachmentsField,
  type TicketAttachmentsFieldHandle,
} from "./ticket-attachments-field";
import { cn } from "@/lib/utils";

const NO_ASSIGNEE = "__none__";

export type TicketFormProps = {
  mode: "create" | "edit";
  ticketId?: string;
  defaultValues?: Partial<CreateTicketInput>;
  companies: Array<{ id: string; name: string; code: string | null }>;
  staff: Array<{ id: string; full_name: string; internal_role: string | null }>;
  /** "internal" = full form (PM tạo ticket cho khách: chọn KH, mã, status,
   *  assignee). "customer" = simplified (KH chỉ điền tiêu đề/mô tả/độ ưu
   *  tiên/đính kèm — server tự fill company_id + status="new" + assignee).
   *  Default: "internal" để giữ backward compat khi gọi không truyền. */
  audience?: "internal" | "customer";
};

export function TicketForm({
  mode,
  ticketId,
  defaultValues,
  companies,
  staff,
  audience = "internal",
}: TicketFormProps) {
  const isCustomer = audience === "customer";
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
      category: defaultValues?.category ?? "technical",
      assignee_id: defaultValues?.assignee_id ?? null,
      attachments: defaultValues?.attachments ?? [],
    },
  });

  const watchedCompanyId = useWatch({ control, name: "company_id" });
  const attachmentsRef = useRef<TicketAttachmentsFieldHandle | null>(null);

  const handleDescriptionPaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) {
          const named =
            f.name === "image.png"
              ? new File([f], `screenshot-${Date.now()}.png`, { type: f.type })
              : f;
          files.push(named);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      attachmentsRef.current?.uploadFiles(files);
    }
  };

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
          {isCustomer ? (
            // Customer: company_id đã pre-fill từ session, KH chỉ thấy 1 dòng
            // info read-only (không sửa được). Mã ticket ẩn — server tự sinh.
            <input type="hidden" {...register("company_id")} />
          ) : (
            <>
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
            </>
          )}
          <Field
            label="Mô tả chi tiết"
            error={errors.description?.message}
            className="md:col-span-2"
          >
            <Textarea
              {...register("description")}
              rows={5}
              placeholder="Mô tả các bước tái hiện, expected vs actual. Có thể dán ảnh trực tiếp (Ctrl/Cmd + V)."
              onPaste={handleDescriptionPaste}
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
                  ref={attachmentsRef}
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
        title={isCustomer ? "Mức độ" : "Phân loại & phân công"}
        description={
          isCustomer
            ? "Đánh giá độ khẩn cấp giúp Clickstar ưu tiên xử lý đúng thứ tự."
            : "Thiết lập độ ưu tiên, trạng thái xử lý và người phụ trách."
        }
      >
        <div
          className={cn(
            "grid gap-4",
            isCustomer ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-4",
          )}
        >
          <Field label="Phân loại *" error={errors.category?.message}>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn phân loại">
                      {(value: string | null) => {
                        if (!value) return null;
                        return (
                          TICKET_CATEGORY_OPTIONS.find((o) => o.value === value)
                            ?.label ?? value
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-[11px] text-slate-500">
                            {opt.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
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
          {!isCustomer && (
            <>
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
            </>
          )}
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
