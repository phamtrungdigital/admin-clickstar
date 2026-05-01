"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getDocumentDownloadUrlAction,
  setDocumentVisibilityAction,
  softDeleteDocumentAction,
} from "@/app/(dashboard)/documents/actions";
import type { DocumentVisibility } from "@/lib/database.types";

export function DocumentRowActions({
  documentId,
  visibility,
  canManage,
}: {
  documentId: string;
  visibility: DocumentVisibility;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  const onDownload = async () => {
    setDownloading(true);
    try {
      const result = await getDocumentDownloadUrlAction(documentId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // Force browser to download via signed URL
      window.open(result.data!.url, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  };

  const onToggleShare = () => {
    const next: DocumentVisibility =
      visibility === "shared" ? "internal" : "shared";
    startTransition(async () => {
      const result = await setDocumentVisibilityAction(documentId, {
        visibility: next,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        next === "shared"
          ? "Đã chia sẻ với khách"
          : "Đã thu hồi quyền chia sẻ",
      );
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!window.confirm("Xoá tài liệu này? Có thể khôi phục bởi super admin."))
      return;
    startTransition(async () => {
      const result = await softDeleteDocumentAction(documentId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã xoá tài liệu");
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        aria-label="Thao tác"
        disabled={isPending || downloading}
      >
        {isPending || downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreVertical className="h-4 w-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" /> Tải xuống
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleShare}>
              {visibility === "shared" ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" /> Thu hồi chia sẻ
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" /> Chia sẻ với khách
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Xoá
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
