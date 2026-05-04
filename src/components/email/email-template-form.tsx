"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createEmailTemplateAndRedirect,
  testSendEmailTemplateAction,
  updateEmailTemplateAction,
} from "@/app/(dashboard)/email/actions";
import {
  upsertEmailTemplateSchema,
  type UpsertEmailTemplateInput,
} from "@/lib/validation/email";
import { EmailEditor } from "@/components/email/email-editor";
import {
  LiveEmailPreview,
  type PreviewVariable,
} from "@/components/email/live-email-preview";

export function EmailTemplateForm({
  mode,
  templateId,
  defaultValues,
}: {
  mode: "create" | "edit";
  templateId?: string;
  defaultValues?: Partial<UpsertEmailTemplateInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [testEmail, setTestEmail] = useState("");
  const [isSending, startSending] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<UpsertEmailTemplateInput>({
    resolver: zodResolver(upsertEmailTemplateSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      name: defaultValues?.name ?? "",
      subject: defaultValues?.subject ?? "",
      html_body: defaultValues?.html_body ?? "",
      text_body: defaultValues?.text_body ?? "",
      variables: defaultValues?.variables ?? "",
      is_active: defaultValues?.is_active ?? true,
    },
  });

  const subject = useWatch({ control, name: "subject" }) ?? "";
  const html = useWatch({ control, name: "html_body" }) ?? "";
  const code = useWatch({ control, name: "code" }) ?? "";

  const placeholders = useMemo(
    () => extractPlaceholders(`${subject}\n${html}`),
    [subject, html],
  );

  // Build variable list cho preview với sample = `[name]`. Khi anh muốn
  // sample thật hơn, có thể chỉnh trong "Biến mong đợi" section sau (MVP
  // bỏ qua, giữ form đơn giản).
  const previewVars: PreviewVariable[] = useMemo(
    () => placeholders.map((name) => ({ name })),
    [placeholders],
  );

  const onSubmit = (values: UpsertEmailTemplateInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createEmailTemplateAndRedirect(values)
          : await updateEmailTemplateAction(templateId!, values);
      if (result && !result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [k, m] of Object.entries(result.fieldErrors)) {
            setError(k as keyof UpsertEmailTemplateInput, { message: m });
          }
        }
        return;
      }
      if (mode === "edit") {
        toast.success("Đã lưu template");
        router.refresh();
      }
    });
  };

  const onTestSend = () => {
    if (!testEmail.includes("@")) {
      toast.error("Vui lòng nhập email hợp lệ để test");
      return;
    }
    if (!code) {
      toast.error("Cần lưu template trước khi test send");
      return;
    }
    const dummy: Record<string, string> = {};
    for (const k of placeholders) dummy[k] = `[${k}]`;
    startSending(async () => {
      const result = await testSendEmailTemplateAction({
        templateCode: code,
        recipientEmail: testEmail,
        vars: dummy,
      });
      if (!result.ok) {
        toast.error(`Gửi thử thất bại: ${result.message}`);
        return;
      }
      toast.success(`Đã gửi email test tới ${testEmail}`);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ============ THÔNG TIN TEMPLATE ============ */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mã template *" error={errors.code?.message}>
            <Input
              {...register("code")}
              placeholder="vd: ticket_assigned"
              className="font-mono"
            />
            <p className="mt-1 text-xs text-slate-500">
              Khoá unique để code gọi lại — chỉ chữ/số/_, không khoảng trắng.
            </p>
          </Field>
          <Field label="Tên hiển thị *" error={errors.name?.message}>
            <Input
              {...register("name")}
              placeholder="Thông báo: Ticket được giao"
            />
          </Field>
        </div>
        <Field
          label="Biến mong đợi (tuỳ chọn — ghi chú cho admin sau này)"
          error={errors.variables?.message}
        >
          <Input
            {...register("variables")}
            placeholder="vd: name, ticket_code, link"
          />
        </Field>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => field.onChange(Boolean(v))}
              />
              Đang hoạt động — code có thể gọi để gửi email
            </label>
          )}
        />
      </div>

      {/* ============ TIÊU ĐỀ EMAIL ============ */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Tiêu đề email — hỗ trợ {"{{biến}}"}
          </span>
        </div>
        <input
          type="text"
          {...register("subject")}
          className={cn(
            "w-full bg-white px-4 py-3 text-base font-medium text-slate-900 focus:bg-blue-50/30 focus:outline-none",
            errors.subject && "border-red-500",
          )}
          placeholder="Subject email..."
        />
        {errors.subject && (
          <p className="border-t border-slate-200 px-4 py-1.5 text-xs text-red-600">
            {errors.subject.message}
          </p>
        )}
      </div>

      {/* ============ EDITOR | LIVE PREVIEW (split-view) ============ */}
      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(420px,520px)]">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <Pencil className="h-3 w-3" />
            Soạn thảo
          </div>
          <Controller
            control={control}
            name="html_body"
            render={({ field }) => (
              <EmailEditor
                value={field.value}
                onChange={field.onChange}
                placeholder="Nhập nội dung email — toolbar phía trên hỗ trợ heading / list / table / link / ảnh / màu / emoji..."
              />
            )}
          />
          {errors.html_body && (
            <p className="text-xs text-red-600">{errors.html_body.message}</p>
          )}
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <LiveEmailPreview
            subject={subject}
            htmlBody={html}
            variables={previewVars}
            minHeight="640px"
          />
        </div>
      </div>

      {/* ============ TEXT FALLBACK ============ */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <Label className="text-sm font-medium text-slate-700">
          Phiên bản text (fallback cho client không hỗ trợ HTML)
        </Label>
        <Textarea
          {...register("text_body")}
          rows={4}
          className="mt-1.5 font-mono text-xs"
          placeholder="Xin chào {{name}}, bạn được giao ticket {{ticket_code}}. Mở ở: {{link}}"
        />
      </div>

      {/* ============ TEST SEND (edit only) ============ */}
      {mode === "edit" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-6 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Test send qua Resend
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              Gửi 1 email tới địa chỉ bạn nhập (placeholder thay bằng tên
              biến trong dấu ngoặc vuông). Lưu template trước nếu vừa thay
              đổi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="email@example.com"
              className="max-w-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={onTestSend}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Gửi thử
            </Button>
          </div>
        </div>
      )}

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
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Tạo template" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function extractPlaceholders(source: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) set.add(m[1]);
  return [...set].sort();
}
