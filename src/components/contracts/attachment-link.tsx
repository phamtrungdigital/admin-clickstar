"use client";

import { useTransition } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getContractAttachmentUrlAction } from "@/app/(dashboard)/contracts/actions";

export function AttachmentLink({
  contractId,
  filename,
  url,
}: {
  contractId: string;
  filename: string | null;
  url: string;
}) {
  const [isPending, startTransition] = useTransition();
  const isExternal = /^https?:\/\//.test(url);

  const open = () => {
    if (isExternal) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    startTransition(async () => {
      const result = await getContractAttachmentUrlAction(contractId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      window.open(result.data!.url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isExternal ? (
        <ExternalLink className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <span className="truncate max-w-xs">
        {filename || (isExternal ? "Mở liên kết" : "Tải PDF")}
      </span>
    </button>
  );
}
