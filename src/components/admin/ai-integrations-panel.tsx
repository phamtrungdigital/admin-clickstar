"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  TestTube2,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AI_MODELS,
  AI_PROVIDERS,
  upsertAiIntegrationSchema,
  type AiProvider,
  type UpsertAiIntegrationInput,
} from "@/lib/validation/ai-integrations";
import {
  createAiIntegrationAction,
  deleteAiIntegrationAction,
  testAiIntegrationAction,
  updateAiIntegrationAction,
} from "@/app/(dashboard)/admin/ai/actions";
import type { AiIntegrationListItem } from "@/lib/queries/ai-integrations";

const PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI GPT",
};

export function AiIntegrationsPanel({
  integrations,
}: {
  integrations: AiIntegrationListItem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AiIntegrationListItem | "new" | null>(
    null,
  );
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testAiIntegrationAction(id);
      if (!result.ok) {
        toast.error(`Test thất bại: ${result.message}`);
        return;
      }
      toast.success(`AI trả lời: "${result.reply.slice(0, 100)}"`, {
        duration: 6000,
      });
    } finally {
      setTestingId(null);
    }
  };

  const onDelete = async (id: string, label: string | null) => {
    const name = label ?? id.slice(0, 8);
    if (!confirm(`Xoá integration "${name}"? Key trong Vault sẽ bị xoá vĩnh viễn.`)) return;
    setDeletingId(id);
    try {
      const result = await deleteAiIntegrationAction(id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã xoá");
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Tích hợp AI
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Cấu hình API key cho Anthropic Claude / OpenAI GPT để dùng trong
            AI gen email, tóm tắt ticket, gợi ý reply, ... Key được mã hoá
            qua Supabase Vault — admin chỉ thấy mask.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setEditing("new")}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Thêm integration
        </Button>
      </div>

      {integrations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
          <h4 className="mt-3 text-sm font-semibold text-slate-900">
            Chưa có AI integration nào
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Bấm &quot;Thêm integration&quot; để cấu hình Anthropic / OpenAI API key.
            Sau khi thêm, các tính năng AI (gen email, tóm tắt ticket, gợi ý
            reply) sẽ tự động dùng integration active.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {integrations.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <span
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold uppercase",
                  row.provider === "anthropic"
                    ? "bg-orange-50 text-orange-700"
                    : "bg-emerald-50 text-emerald-700",
                )}
              >
                {row.provider === "anthropic" ? "AI" : "AI"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {row.label || PROVIDER_LABEL[row.provider]}
                  </p>
                  {row.is_active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Đang hoạt động
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                      <XCircle className="h-3 w-3" />
                      Tắt
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {PROVIDER_LABEL[row.provider]} · {row.model} ·{" "}
                  <span className="font-mono">{row.key_mask}</span>
                  {" · "}
                  Tạo {format(new Date(row.created_at), "dd/MM/yyyy")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onTest(row.id)}
                disabled={testingId === row.id}
              >
                {testingId === row.id ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <TestTube2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Test
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(row)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Sửa
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(row.id, row.label)}
                disabled={deletingId === row.id}
                className="text-rose-600 hover:text-rose-700"
              >
                {deletingId === row.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AiIntegrationDialog
        open={editing !== null}
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function AiIntegrationDialog({
  open,
  target,
  onClose,
  onSaved,
}: {
  open: boolean;
  target: AiIntegrationListItem | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = target !== null && target !== "new";
  const editingRow = isEdit ? (target as AiIntegrationListItem) : null;
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpsertAiIntegrationInput>({
    resolver: zodResolver(upsertAiIntegrationSchema),
    defaultValues: {
      provider: editingRow?.provider ?? "anthropic",
      model:
        editingRow?.model ?? AI_MODELS.anthropic[0]?.value ?? "claude-sonnet-4-20250514",
      api_key: "",
      label: editingRow?.label ?? "",
      notes: editingRow?.notes ?? "",
      is_active: editingRow?.is_active ?? true,
    },
  });

  const provider = watch("provider");

  // Reset form khi đổi target (edit row khác / new)
  // — controlled bởi key + open prop; useEffect sync defaults
  // (skipped useEffect vì Dialog unmount khi close → fresh state mỗi lần open)

  const onSubmit = (values: UpsertAiIntegrationInput) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateAiIntegrationAction(editingRow!.id, values)
        : await createAiIntegrationAction(values);
      if (!result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [k, m] of Object.entries(result.fieldErrors)) {
            setError(k as keyof UpsertAiIntegrationInput, { message: m });
          }
        }
        return;
      }
      toast.success(isEdit ? "Đã cập nhật" : "Đã thêm integration");
      reset();
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sửa AI integration" : "Thêm AI integration"}
          </DialogTitle>
          <DialogDescription>
            API key được mã hoá qua Supabase Vault. Sau khi lưu, key
            không thể đọc lại — chỉ test connection / rotate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Provider *
              </Label>
              <Controller
                control={control}
                name="provider"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v as AiProvider)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value: string | null) =>
                          value
                            ? PROVIDER_LABEL[value as AiProvider]
                            : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PROVIDER_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Model *
              </Label>
              <Controller
                control={control}
                name="model"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(v) => v && field.onChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn model">
                        {(value: string | null) => {
                          if (!value) return null;
                          return (
                            AI_MODELS[provider]?.find((m) => m.value === value)
                              ?.label ?? value
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(AI_MODELS[provider] ?? []).map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              API Key {isEdit ? "(để trống = giữ nguyên)" : "*"}
            </Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={
                provider === "anthropic" ? "sk-ant-..." : "sk-..."
              }
              {...register("api_key")}
              className="font-mono"
            />
            {errors.api_key && (
              <p className="text-xs text-red-600">{errors.api_key.message}</p>
            )}
            {isEdit && (
              <p className="text-xs text-slate-500">
                Hiện tại:{" "}
                <code className="font-mono">{editingRow!.key_mask}</code>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Tên gợi nhớ (tuỳ chọn)
            </Label>
            <Input
              {...register("label")}
              placeholder="Claude Production / OpenAI Test"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Ghi chú
            </Label>
            <Textarea
              {...register("notes")}
              rows={2}
              placeholder="Mô tả dùng cho mục đích gì, account nào..."
            />
          </div>
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(Boolean(v))}
                />
                Đang hoạt động — tính năng AI sẽ tự động dùng integration này
              </label>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Lưu thay đổi" : "Thêm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
