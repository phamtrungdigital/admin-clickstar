"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMilestoneAction } from "@/app/(dashboard)/projects/[id]/milestone-actions";

/**
 * Nút "+ Thêm công việc" inline cho admin/PM thêm milestone ad-hoc vào
 * project (đặc biệt cần cho project mode manual/rolling, hoặc project
 * trống không từ template).
 *
 * Chỉ render khi canManage = true.
 */
export function AddMilestoneButton({
  projectId,
  canManage,
  /** Hiện hint text "PM tự thêm công việc khi triển khai" — true cho
   *  project mode manual/rolling. */
  showHint = false,
}: {
  projectId: string;
  canManage: boolean;
  showHint?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  if (!canManage) return null;

  const reset = () => {
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
  };

  const submit = () => {
    if (title.trim().length < 1) {
      toast.error("Cần nhập tên công việc");
      return;
    }
    startTransition(async () => {
      const result = await createMilestoneAction({
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã thêm công việc");
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="border-blue-200 bg-blue-50/40 text-blue-700 hover:bg-blue-50"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Thêm công việc
        </Button>
        {showHint && (
          <p className="text-[11px] text-slate-500">
            Dự án không từ template — PM tự thêm công việc khi triển khai.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Thêm công việc mới</p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Đóng"
          disabled={isPending}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-700">Tên công việc *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Khảo sát yêu cầu khách hàng"
          disabled={isPending}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-700">Mô tả</Label>
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ghi chú về phạm vi, mục tiêu của công việc này..."
          disabled={isPending}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">
            Bắt đầu (tuỳ chọn)
          </Label>
          <Input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">
            Kết thúc (tuỳ chọn)
          </Label>
          <Input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Có thể bỏ trống ngày — set sau khi tiến hành. Status mặc định: Sắp tới.
      </p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={isPending}
        >
          Huỷ
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={isPending || !title.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Plus className="mr-1 h-3 w-3" />
          )}
          Thêm
        </Button>
      </div>
    </div>
  );
}
