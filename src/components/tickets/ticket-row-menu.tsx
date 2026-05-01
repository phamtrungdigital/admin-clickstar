"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  changeTicketStatusAction,
  softDeleteTicketAction,
} from "@/app/(dashboard)/tickets/actions";
import {
  TICKET_STATUS_OPTIONS,
  type CreateTicketInput,
} from "@/lib/validation/tickets";
import type { TicketStatus } from "@/lib/database.types";

export function TicketRowMenu({
  id,
  title,
  currentStatus,
}: {
  id: string;
  title: string;
  currentStatus: TicketStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onChangeStatus = (status: CreateTicketInput["status"]) => {
    if (status === currentStatus) return;
    startTransition(async () => {
      const result = await changeTicketStatusAction(id, status);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã đổi trạng thái");
      router.refresh();
    });
  };

  const onDelete = () => {
    if (
      !window.confirm(
        `Xác nhận xoá ticket "${title}"? Bản ghi sẽ chuyển sang trạng thái đã xoá.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await softDeleteTicketAction(id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã xoá ticket");
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        aria-label="Thao tác"
        disabled={isPending}
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => router.push(`/tickets/${id}`)}>
          <Eye className="mr-2 h-4 w-4" /> Xem chi tiết
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/tickets/${id}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Đổi trạng thái</DropdownMenuLabel>
        {TICKET_STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChangeStatus(opt.value)}
            disabled={opt.value === currentStatus}
          >
            <CheckCircle2
              className={
                opt.value === currentStatus
                  ? "mr-2 h-4 w-4 text-blue-600"
                  : "mr-2 h-4 w-4 text-slate-300"
              }
            />
            {opt.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Xoá
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
