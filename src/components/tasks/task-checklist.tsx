"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteTaskChecklistItemAction,
  toggleTaskChecklistItemAction,
  upsertTaskChecklistItemAction,
} from "@/app/(dashboard)/tasks/actions";
import type { TaskChecklistItemRow } from "@/lib/database.types";

export function TaskChecklistEditor({
  taskId,
  items,
  canManage,
}: {
  taskId: string;
  items: TaskChecklistItemRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const onAdd = () => {
    if (!content.trim()) return;
    startTransition(async () => {
      const r = await upsertTaskChecklistItemAction(taskId, {
        content,
        sort_order: items.length,
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setContent("");
      router.refresh();
    });
  };

  const onToggle = (id: string, next: boolean) => {
    startTransition(async () => {
      const r = await toggleTaskChecklistItemAction(taskId, id, next);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      router.refresh();
    });
  };

  const onDelete = (id: string) => {
    if (!window.confirm("Xoá mục checklist này?")) return;
    startTransition(async () => {
      const r = await deleteTaskChecklistItemAction(taskId, id);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Checklist ({doneCount}/{total})
        </h3>
        {total > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="font-medium text-slate-700">{percent}%</span>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-center text-xs text-slate-500">
          Chưa có mục checklist nào.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md hover:bg-slate-50 px-2 py-1.5 -mx-2"
            >
              <Checkbox
                checked={item.done}
                onCheckedChange={(c) => onToggle(item.id, c === true)}
                disabled={!canManage || isPending}
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  item.done && "text-slate-400 line-through",
                )}
              >
                {item.content}
              </span>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(item.id)}
                  disabled={isPending}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Thêm mục checklist..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            disabled={isPending}
          />
          <Button
            type="button"
            size="sm"
            onClick={onAdd}
            disabled={isPending || !content.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </section>
  );
}
