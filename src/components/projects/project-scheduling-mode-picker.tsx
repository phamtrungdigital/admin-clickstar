"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CalendarOff, Loader2, Pencil, Repeat2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setProjectSchedulingModeAction } from "@/app/(dashboard)/projects/actions";
import { SCHEDULING_MODE_OPTIONS } from "@/lib/validation/projects";
import type { SchedulingMode } from "@/lib/database.types";

const MODE_TONE: Record<
  SchedulingMode,
  { tone: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  auto: {
    tone: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: Calendar,
    label: "Tự động",
  },
  manual: {
    tone: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: CalendarOff,
    label: "Linh hoạt",
  },
  rolling: {
    tone: "bg-violet-50 text-violet-700 ring-violet-200",
    icon: Repeat2,
    label: "Vận hành liên tục",
  },
};

/**
 * Inline picker để admin/manager đổi scheduling mode của project sau
 * khi tạo (vd. chuyển từ "Linh hoạt" → "Tự động" khi ký HĐ thêm cam kết
 * deadline).
 *
 * - canManage = false: chỉ render badge readonly
 * - canManage = true: badge + nút "Đổi" inline → expand 3 options
 */
export function ProjectSchedulingModePicker({
  projectId,
  currentMode,
  canManage,
}: {
  projectId: string;
  currentMode: SchedulingMode;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const meta = MODE_TONE[currentMode];
  const Icon = meta.icon;

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
            meta.tone,
          )}
        >
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            <Pencil className="h-3 w-3" />
            Đổi
          </button>
        )}
      </div>
    );
  }

  const submit = (mode: SchedulingMode) => {
    if (mode === currentMode) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await setProjectSchedulingModeAction(projectId, mode);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã đổi loại lịch trình");
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {SCHEDULING_MODE_OPTIONS.map((opt) => {
          const m = MODE_TONE[opt.value];
          const Mi = m.icon;
          const active = opt.value === currentMode;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => submit(opt.value)}
              disabled={isPending}
              className={cn(
                "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-all",
                active
                  ? "border-blue-300 bg-blue-50/60"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <Mi className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-900">{opt.label}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                  {opt.hint}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(false)}
          disabled={isPending}
          className="h-7 px-2 text-xs"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <X className="mr-1 h-3 w-3" />
          )}
          Đóng
        </Button>
      </div>
    </div>
  );
}

/** Helper để render badge readonly bên ngoài (vd. customer view sidepanel) */
export function SchedulingModeBadge({ mode }: { mode: SchedulingMode }) {
  const meta = MODE_TONE[mode];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        meta.tone,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
