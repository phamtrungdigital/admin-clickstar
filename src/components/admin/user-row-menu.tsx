"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, MoreVertical, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  softDeleteUserAction,
  toggleUserActiveAction,
} from "@/app/(dashboard)/admin/users/actions";

export function UserRowMenu({
  id,
  name,
  isActive,
  customersCount,
}: {
  id: string;
  name: string;
  isActive: boolean;
  customersCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onToggle = () => {
    if (isActive && customersCount > 0) {
      const ok = window.confirm(
        `User này đang phụ trách ${customersCount} khách hàng. Bạn có thể reassign trước khi vô hiệu hoá. Tiếp tục vô hiệu hoá luôn?`,
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await toggleUserActiveAction(id, !isActive);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(isActive ? "Đã vô hiệu hoá" : "Đã kích hoạt lại");
      router.refresh();
    });
  };

  const onDelete = () => {
    if (
      !window.confirm(
        `Xác nhận xoá tài khoản "${name}"? Bản ghi sẽ chuyển sang đã xoá.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await softDeleteUserAction(id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã xoá tài khoản");
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
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push(`/admin/users/${id}`)}>
          <Eye className="mr-2 h-4 w-4" /> Xem chi tiết
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/admin/users/${id}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggle}>
          <Power className="mr-2 h-4 w-4" />
          {isActive ? "Vô hiệu hoá" : "Kích hoạt lại"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Xoá
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
