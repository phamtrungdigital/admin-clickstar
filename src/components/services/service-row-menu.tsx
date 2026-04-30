"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, MoreVertical, PauseCircle, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteServiceAction,
  toggleServiceActiveAction,
} from "@/app/(dashboard)/services/actions";

export function ServiceRowMenu({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onToggle = () => {
    startTransition(async () => {
      const result = await toggleServiceActiveAction(id, !isActive);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(isActive ? "Đã tạm ngưng dịch vụ" : "Đã bật lại dịch vụ");
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!window.confirm(`Xác nhận xoá dịch vụ "${name}"? Thao tác không hoàn tác.`))
      return;
    startTransition(async () => {
      const result = await deleteServiceAction(id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã xoá dịch vụ");
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
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => router.push(`/services/${id}`)}>
          <Eye className="mr-2 h-4 w-4" /> Xem chi tiết
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`/services/${id}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggle}>
          {isActive ? (
            <>
              <PauseCircle className="mr-2 h-4 w-4" /> Tạm ngưng
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" /> Bật lại
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Xoá
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
