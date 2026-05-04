"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setProjectPmAction } from "@/app/(dashboard)/projects/actions";

export type StaffOption = {
  id: string;
  full_name: string;
  internal_role: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  support: "Support",
  accountant: "Kế toán",
};

/**
 * Inline picker để admin/manager gán/đổi PM của project.
 *
 * - Nếu canManage = false (staff thường) hoặc đã có PM: chỉ render text.
 * - Nếu canManage = true: hiện nút "Gán PM" / "Đổi" inline, click mở
 *   dropdown chọn staff. Submit gọi setProjectPmAction.
 */
export function ProjectPmPicker({
  projectId,
  currentPm,
  staffOptions,
  canManage,
}: {
  projectId: string;
  currentPm: { id: string; full_name: string } | null;
  staffOptions: StaffOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string>(currentPm?.id ?? "");

  // View mode
  if (!canManage || !editing) {
    return (
      <div className="flex items-center gap-2">
        {currentPm ? (
          <span className="text-sm text-slate-800">{currentPm.full_name}</span>
        ) : (
          <span className="text-sm italic text-slate-400">Chưa gán</span>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            {currentPm ? (
              <>
                <Pencil className="h-3 w-3" />
                Đổi
              </>
            ) : (
              <>
                <UserPlus className="h-3 w-3" />
                Gán PM
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // Edit mode
  const submit = () => {
    const newPm = picked === "" ? null : picked;
    if (newPm === (currentPm?.id ?? null)) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await setProjectPmAction(projectId, newPm);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(newPm ? "Đã gán PM" : "Đã bỏ PM");
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Select
        value={picked || "__none__"}
        onValueChange={(v) => setPicked(!v || v === "__none__" ? "" : v)}
        disabled={isPending}
      >
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue placeholder="Chọn PM">
            {(value: string | null) => {
              if (!value || value === "__none__") return "— Chưa gán —";
              const s = staffOptions.find((o) => o.id === value);
              return s?.full_name ?? value;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Chưa gán —</SelectItem>
          {staffOptions.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.full_name}
              {s.internal_role && (
                <span className="ml-1 text-[10px] text-slate-400">
                  ({ROLE_LABEL[s.internal_role] ?? s.internal_role})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setPicked(currentPm?.id ?? "");
            setEditing(false);
          }}
          disabled={isPending}
          className="h-7 px-2 text-xs"
        >
          <X className="mr-1 h-3 w-3" />
          Huỷ
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={isPending}
          className="h-7 bg-blue-600 px-2 text-xs hover:bg-blue-700"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Check className="mr-1 h-3 w-3" />
          )}
          Lưu
        </Button>
      </div>
    </div>
  );
}
