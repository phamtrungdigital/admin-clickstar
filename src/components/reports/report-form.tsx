"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  createReportAndRedirect,
  updateReportAction,
} from "@/app/(dashboard)/reports/actions";
import {
  upsertReportSchema,
  type UpsertReportInput,
} from "@/lib/validation/reports";
import { renderMarkdown } from "@/lib/markdown";

export type ProjectOption = {
  id: string;
  name: string;
  company_name: string | null;
};

export type ReportFormProps = {
  mode: "create" | "edit";
  reportId?: string;
  defaultValues?: Partial<UpsertReportInput>;
  projects: ProjectOption[];
};

export function ReportForm({
  mode,
  reportId,
  defaultValues,
  projects,
}: ReportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<"edit" | "preview">("edit");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<UpsertReportInput>({
    resolver: zodResolver(upsertReportSchema),
    defaultValues: {
      project_id: defaultValues?.project_id ?? "",
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      period_start: defaultValues?.period_start ?? "",
      period_end: defaultValues?.period_end ?? "",
      content: defaultValues?.content ?? "",
    },
  });

  const watchedContent = watch("content");

  const onSubmit = (values: UpsertReportInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createReportAndRedirect(values)
          : await updateReportAction(reportId!, values);
      if (result && !result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [k, m] of Object.entries(result.fieldErrors)) {
            setError(k as keyof UpsertReportInput, { message: m });
          }
        }
        return;
      }
      if (mode === "edit") {
        toast.success("Đã lưu báo cáo");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <Label className="text-sm font-medium text-slate-700">Tiêu đề *</Label>
          <Input
            className={cn("mt-1.5", errors.title && "border-red-500")}
            placeholder="VD: Báo cáo SEO tháng 4/2026"
            {...register("title")}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="text-sm font-medium text-slate-700">Dự án *</Label>
            <Controller
              control={control}
              name="project_id"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => v && field.onChange(v)}
                >
                  <SelectTrigger
                    className={cn(
                      "mt-1.5 w-full",
                      errors.project_id && "border-red-500",
                    )}
                  >
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
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Kỳ bắt đầu
            </Label>
            <Input
              type="date"
              className="mt-1.5"
              {...register("period_start")}
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Kỳ kết thúc
            </Label>
            <Input
              type="date"
              className="mt-1.5"
              {...register("period_end")}
            />
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Mô tả ngắn
          </Label>
          <Textarea
            rows={2}
            className="mt-1.5"
            placeholder="VD: Tổng kết SEO tháng 4 — rank top 10 từ khoá quan trọng..."
            {...register("description")}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
          <Label className="text-sm font-medium text-slate-700">
            Nội dung báo cáo (Markdown)
          </Label>
          <Tabs value={view} onValueChange={(v) => v && setView(v as typeof view)}>
            <TabsList className="rounded-md bg-slate-100 p-0.5">
              <TabsTrigger
                value="edit"
                className="px-2.5 py-1 text-xs data-active:bg-white data-active:text-slate-900 data-active:shadow-sm"
              >
                Soạn
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="px-2.5 py-1 text-xs data-active:bg-white data-active:text-slate-900 data-active:shadow-sm"
              >
                <Eye className="mr-1 inline h-3 w-3" />
                Xem trước
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {view === "edit" ? (
          <div className="p-6">
            <Textarea
              rows={20}
              className={cn(
                "font-mono text-sm leading-relaxed",
                errors.content && "border-red-500",
              )}
              placeholder={`# Tổng quan\n\nTóm tắt 1-2 câu...\n\n## Đã hoàn thành\n\n- Item 1\n- Item 2\n\n## Đề xuất\n\n...`}
              {...register("content")}
            />
            {errors.content && (
              <p className="mt-1 text-xs text-red-600">
                {errors.content.message}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Hỗ trợ Markdown: **đậm**, *nghiêng*, # heading, - danh sách,
              [link](url).
            </p>
          </div>
        ) : (
          <div
            className="prose prose-slate max-w-none px-6 py-6 text-sm"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(watchedContent || "*(chưa có nội dung)*"),
            }}
          />
        )}
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
          {mode === "create" ? "Tạo báo cáo (Nháp)" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
