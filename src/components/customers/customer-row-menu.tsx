"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCustomerCascadeCounts,
  softDeleteCustomerAction,
} from "@/app/(dashboard)/customers/actions";

export function CustomerRowMenu({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    startTransition(async () => {
      // Đếm trước trong cùng transition để confirm dialog hiện đúng số.
      const counts = await getCustomerCascadeCounts(id);
      const total =
        counts.projects +
        counts.tasks +
        counts.tickets +
        counts.contracts +
        counts.documents;

      const cascadeLines: string[] = [];
      if (counts.projects > 0)
        cascadeLines.push(`• ${counts.projects} dự án`);
      if (counts.tasks > 0) cascadeLines.push(`• ${counts.tasks} công việc`);
      if (counts.tickets > 0) cascadeLines.push(`• ${counts.tickets} ticket`);
      if (counts.contracts > 0)
        cascadeLines.push(`• ${counts.contracts} hợp đồng`);
      if (counts.documents > 0)
        cascadeLines.push(`• ${counts.documents} tài liệu`);

      const cascadeBlock =
        total > 0
          ? `\n\nCẢNH BÁO: cũng sẽ xoá theo:\n${cascadeLines.join("\n")}`
          : "";

      const ok = window.confirm(
        `Xác nhận xoá khách hàng "${name}"?${cascadeBlock}\n\nBản ghi chuyển sang trạng thái đã xoá (có thể khôi phục bởi admin).`,
      );
      if (!ok) return;

      const result = await softDeleteCustomerAction(id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const c = result.data?.cascade;
      const cascadeTotal = c
        ? c.projects + c.tasks + c.tickets + c.contracts + c.documents
        : 0;
      toast.success(
        cascadeTotal > 0
          ? `Đã xoá khách hàng + ${cascadeTotal} mục liên quan`
          : "Đã xoá khách hàng",
      );
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
        <DropdownMenuItem onClick={() => router.push(`/customers/${id}`)}>
          <Eye className="mr-2 h-4 w-4" /> Xem chi tiết
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/customers/${id}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Xoá
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
