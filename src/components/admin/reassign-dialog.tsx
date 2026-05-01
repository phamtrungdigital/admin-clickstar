"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reassignAllAssignmentsAction } from "@/app/(dashboard)/admin/users/actions";
import { roleLabel } from "@/lib/validation/users";

export function ReassignButton({
  fromUserId,
  fromUserName,
  customersCount,
  candidates,
}: {
  fromUserId: string;
  fromUserName: string;
  customersCount: number;
  candidates: Array<{ id: string; full_name: string; internal_role: string | null }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  if (customersCount === 0) return null;

  const submit = () => {
    if (!target) {
      toast.error("Chọn người tiếp nhận");
      return;
    }
    startTransition(async () => {
      const result = await reassignAllAssignmentsAction(fromUserId, target);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        `Đã chuyển ${result.data?.moved ?? 0} khách hàng sang người mới`,
      );
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        size="sm"
      >
        <ArrowRightLeft className="mr-2 h-4 w-4" />
        Reassign all
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Chuyển toàn bộ khách hàng
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Chuyển <strong>{customersCount}</strong> khách hàng đang phụ trách
              bởi <strong>{fromUserName}</strong> sang người tiếp nhận.
            </p>

            <div className="mt-4 space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Người tiếp nhận
              </Label>
              <Select value={target} onValueChange={(v) => setTarget(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn người tiếp nhận">
                    {(value: string | null) => {
                      if (!value) return null;
                      const c = candidates.find((c) => c.id === value);
                      return c?.full_name ?? value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                      {c.internal_role
                        ? ` · ${roleLabel(c.internal_role)}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Chuyển
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
