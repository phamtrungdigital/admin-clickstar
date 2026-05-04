"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addTicketCommentAction } from "@/app/(dashboard)/tickets/actions";
import {
  TicketAttachmentsField,
  type TicketAttachmentsFieldHandle,
} from "@/components/tickets/ticket-attachments-field";
import { TicketAttachmentsDisplay } from "@/components/tickets/ticket-attachments-display";
import type {
  TicketAttachment,
  TicketStatus,
} from "@/lib/database.types";
import type { TicketCommentItem } from "@/lib/queries/ticket-comments";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Nhân viên",
  support: "CSKH",
  accountant: "Kế toán",
};

export function TicketComments({
  ticketId,
  ticketStatus,
  comments,
  attachmentUrls,
  currentUserId,
  isInternalUser,
  companyId,
}: {
  ticketId: string;
  ticketStatus: TicketStatus;
  comments: TicketCommentItem[];
  /** Pre-signed URLs for attachment paths. Loaded server-side. */
  attachmentUrls: Record<string, string>;
  currentUserId: string;
  isInternalUser: boolean;
  /** Used by attachment uploader to bucket files under companies/<id>/. */
  companyId: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isPending, startTransition] = useTransition();
  const attachmentsRef = useRef<TicketAttachmentsFieldHandle | null>(null);

  const handleSubmit = () => {
    if (!body.trim()) {
      toast.error("Vui lòng nhập nội dung");
      return;
    }
    startTransition(async () => {
      const result = await addTicketCommentAction(ticketId, {
        body: body.trim(),
        is_internal: isInternalUser ? isInternalNote : false,
        attachments,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setBody("");
      setAttachments([]);
      setIsInternalNote(false);
      toast.success(
        isInternalUser && isInternalNote
          ? "Đã thêm note nội bộ"
          : "Đã gửi phản hồi",
      );
      router.refresh();
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) {
          const named =
            f.name === "image.png"
              ? new File([f], `screenshot-${Date.now()}.png`, { type: f.type })
              : f;
          files.push(named);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      attachmentsRef.current?.uploadFiles(files);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-base font-semibold text-slate-900">
          Trao đổi ({comments.length})
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {isInternalUser
            ? "Bình luận công khai khách thấy được. Bật \"Note nội bộ\" để chỉ nội bộ Clickstar đọc."
            : "Phản hồi của bạn sẽ được gửi tới đội xử lý của Clickstar."}
        </p>
      </div>

      {/* Thread */}
      <ul className="divide-y divide-slate-100">
        {comments.length === 0 ? (
          <li className="px-6 py-10 text-center text-sm text-slate-500">
            Chưa có trao đổi nào — gửi tin nhắn đầu tiên ở dưới.
          </li>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwn={c.author_id === currentUserId}
              attachmentUrls={attachmentUrls}
            />
          ))
        )}
      </ul>

      {/* Compose */}
      {ticketStatus === "closed" ? (
        <div className="border-t border-slate-200 px-6 py-4 text-center text-sm text-slate-500">
          Ticket đã đóng — không thể gửi thêm phản hồi.
        </div>
      ) : (
        <div className="space-y-3 border-t border-slate-200 px-6 py-4">
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={handlePaste}
            placeholder={
              isInternalUser
                ? "Nhập phản hồi cho khách hoặc note nội bộ. Có thể dán ảnh trực tiếp (Ctrl/Cmd+V)."
                : "Nhập phản hồi của bạn cho đội Clickstar. Có thể dán ảnh trực tiếp (Ctrl/Cmd+V)."
            }
            disabled={isPending}
          />

          <TicketAttachmentsField
            ref={attachmentsRef}
            companyId={companyId}
            value={attachments}
            onChange={setAttachments}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {isInternalUser ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={isInternalNote}
                  onCheckedChange={(v) => setIsInternalNote(Boolean(v))}
                  disabled={isPending}
                />
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Note nội bộ — khách không thấy
              </label>
            ) : (
              <span />
            )}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !body.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-1.5 h-4 w-4" />
              {isInternalUser && isInternalNote
                ? "Lưu note"
                : "Gửi phản hồi"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  isOwn,
  attachmentUrls,
}: {
  comment: TicketCommentItem;
  isOwn: boolean;
  attachmentUrls: Record<string, string>;
}) {
  const author = comment.author;
  const initials =
    (author?.full_name ?? "?")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(-2)
      .join("")
      .toUpperCase() || "?";
  const isCustomerAuthor = author?.audience === "customer";
  const roleLabel = author?.internal_role
    ? ROLE_LABEL[author.internal_role] ?? author.internal_role
    : isCustomerAuthor
      ? "Khách hàng"
      : null;
  const attachments = (comment.attachments as TicketAttachment[] | null) ?? [];

  return (
    <li className="flex gap-3 px-6 py-4">
      <span
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium",
          isCustomerAuthor
            ? "bg-emerald-100 text-emerald-700"
            : "bg-blue-100 text-blue-700",
        )}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-900">
            {author?.full_name ?? "Người dùng đã xoá"}
            {isOwn && (
              <span className="ml-1 text-xs font-normal text-slate-400">
                (bạn)
              </span>
            )}
          </span>
          {roleLabel && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {roleLabel}
            </span>
          )}
          {comment.is_internal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              <Lock className="h-3 w-3" /> Note nội bộ
            </span>
          )}
          <span className="text-xs text-slate-400">
            {format(new Date(comment.created_at), "dd/MM/yyyy HH:mm", {
              locale: vi,
            })}
          </span>
        </div>
        <div
          className={cn(
            "mt-1.5 whitespace-pre-wrap rounded-lg p-3 text-sm leading-relaxed",
            comment.is_internal
              ? "bg-amber-50/50 text-amber-900 ring-1 ring-inset ring-amber-100"
              : "bg-slate-50 text-slate-800",
          )}
        >
          {comment.body}
        </div>
        {attachments.length > 0 && (
          <div className="mt-2">
            <TicketAttachmentsDisplay
              attachments={attachments}
              urls={attachmentUrls}
            />
          </div>
        )}
      </div>
    </li>
  );
}
