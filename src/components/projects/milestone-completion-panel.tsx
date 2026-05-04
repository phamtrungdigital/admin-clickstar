"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { UNDO_WINDOW_MINUTES } from "@/lib/validation/milestones";
import {
  reopenMilestoneAction,
  undoMilestoneCompletionAction,
} from "@/app/(dashboard)/projects/[id]/milestone-actions";
import type {
  MilestoneAttachment,
  MilestoneCompletionItem,
  MilestoneLink,
} from "@/lib/queries/milestones";

const SIGNED_URL_TTL = 60 * 60;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function MilestoneCompletionPanel({
  completion,
  milestoneId,
  currentUserId,
  isAdmin,
}: {
  completion: MilestoneCompletionItem;
  milestoneId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Tính thời gian còn lại để được "Hoàn tác" (chỉ author trong N phút)
  const isAuthor = completion.completed_by?.id === currentUserId;
  const minutesElapsed = useMemo(
    () =>
      (Date.now() - new Date(completion.completed_at).getTime()) / 60_000,
    [completion.completed_at],
  );
  const [canUndo, setCanUndo] = useState(
    isAuthor && minutesElapsed < UNDO_WINDOW_MINUTES,
  );
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.floor(UNDO_WINDOW_MINUTES * 60 - minutesElapsed * 60)),
  );

  // Đếm ngược live cho cửa sổ undo
  useEffect(() => {
    if (!isAuthor || !canUndo) return;
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.floor(
          UNDO_WINDOW_MINUTES * 60 -
            (Date.now() - new Date(completion.completed_at).getTime()) / 1000,
        ),
      );
      setSecondsLeft(left);
      if (left === 0) setCanUndo(false);
    }, 1000);
    return () => clearInterval(timer);
  }, [isAuthor, canUndo, completion.completed_at]);

  const handleUndo = () => {
    if (!confirm("Hoàn tác báo hoàn thành — milestone sẽ revert về 'Đang thực hiện'. Tiếp tục?"))
      return;
    startTransition(async () => {
      const result = await undoMilestoneCompletionAction(completion.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã hoàn tác");
      router.refresh();
    });
  };

  const handleReopen = () => {
    if (reopenReason.trim().length < 5) {
      toast.error("Lý do cần ít nhất 5 ký tự");
      return;
    }
    startTransition(async () => {
      const result = await reopenMilestoneAction(milestoneId, {
        reason: reopenReason.trim(),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã mở lại milestone");
      setReopenOpen(false);
      setReopenReason("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              Đã nghiệm thu bởi{" "}
              <span className="font-semibold">
                {completion.completed_by?.full_name ?? "(không rõ)"}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {format(
                new Date(completion.completed_at),
                "dd/MM/yyyy 'lúc' HH:mm",
              )}{" "}
              ·{" "}
              {formatDistanceToNow(new Date(completion.completed_at), {
                locale: vi,
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {canUndo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={isPending}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              {isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="mr-1 h-3.5 w-3.5" />
              )}
              Hoàn tác ({Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")})
            </Button>
          )}
          {isAdmin && !reopenOpen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReopenOpen(true)}
              disabled={isPending}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Mở lại
            </Button>
          )}
        </div>
      </div>

      {/* Mô tả nghiệm thu */}
      <div className="rounded-md border border-emerald-100 bg-white p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Mô tả nghiệm thu
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
          {completion.summary}
        </p>
      </div>

      {/* Attachments */}
      {completion.attachments.length > 0 && (
        <AttachmentList attachments={completion.attachments} />
      )}

      {/* Links */}
      {completion.links.length > 0 && (
        <LinkList links={completion.links} />
      )}

      {/* Reopen dialog inline */}
      {reopenOpen && (
        <div className="space-y-2 border-t border-emerald-200 pt-3">
          <Label className="text-xs font-medium text-slate-700">
            Lý do mở lại milestone *
          </Label>
          <Textarea
            rows={3}
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            disabled={isPending}
            placeholder="VD: Khách phản hồi chưa đúng yêu cầu, cần làm lại phần X..."
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setReopenOpen(false);
                setReopenReason("");
              }}
              disabled={isPending}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleReopen}
              disabled={isPending || reopenReason.trim().length < 5}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
              )}
              Mở lại + thông báo NV
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentList({
  attachments,
}: {
  attachments: MilestoneAttachment[];
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrls(
          attachments.map((a) => a.path),
          SIGNED_URL_TTL,
        );
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      for (const item of data) {
        if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
      }
      setSignedUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Tệp đính kèm ({attachments.length})
      </p>
      <ul className="space-y-1">
        {attachments.map((a) => {
          const isImage = a.content_type.startsWith("image/");
          const url = signedUrls[a.path];
          return (
            <li
              key={a.path}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
            >
              {isImage ? (
                <ImageIcon className="h-4 w-4 flex-shrink-0 text-violet-600" />
              ) : (
                <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
              )}
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-slate-700 hover:text-blue-700 hover:underline"
                >
                  {a.filename}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  {a.filename}
                </span>
              )}
              <span className="flex-shrink-0 text-xs text-slate-500">
                {formatBytes(a.size)}
              </span>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-blue-600"
                  aria-label="Mở"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LinkList({ links }: { links: MilestoneLink[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Liên kết ({links.length})
      </p>
      <ul className="space-y-1">
        {links.map((l, idx) => (
          <li
            key={idx}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <Link2 className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-blue-700 hover:underline"
            >
              {l.label || l.url}
            </a>
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Suppress unused (cn reserved for future tweaks)
void cn;
