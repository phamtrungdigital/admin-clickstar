"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Eye, EyeOff, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MentionTextarea } from "@/components/comments/mention-textarea";
import { CommentBody } from "@/components/comments/comment-body";
import { serializeMentions } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import {
  addCustomerTaskCommentAction,
  addTaskCommentAction,
} from "@/app/(dashboard)/tasks/actions";
import type { TaskCommentItem } from "@/lib/queries/tasks";

type Channel = "internal" | "customer";

export function TaskCommentsThread({
  taskId,
  comments,
  currentUserId,
  canPostInternal,
  canPostCustomer,
}: {
  taskId: string;
  comments: TaskCommentItem[];
  currentUserId: string;
  canPostInternal: boolean;
  canPostCustomer: boolean;
}) {
  // Default tab: internal staff sees "internal" first; customer sees "customer".
  const [channel, setChannel] = useState<Channel>(
    canPostInternal ? "internal" : "customer",
  );

  const filtered = comments.filter((c) =>
    channel === "internal" ? c.is_internal : !c.is_internal,
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Bình luận</h3>
        {canPostInternal && (
          <Tabs
            value={channel}
            onValueChange={(v) => v && setChannel(v as Channel)}
          >
            <TabsList className="rounded-md bg-slate-100 p-0.5">
              <TabsTrigger
                value="internal"
                className="px-2.5 py-1 text-xs data-active:bg-white data-active:text-slate-900 data-active:shadow-sm"
              >
                <EyeOff className="mr-1 inline h-3 w-3" />
                Nội bộ ({comments.filter((c) => c.is_internal).length})
              </TabsTrigger>
              <TabsTrigger
                value="customer"
                className="px-2.5 py-1 text-xs data-active:bg-white data-active:text-slate-900 data-active:shadow-sm"
              >
                <Eye className="mr-1 inline h-3 w-3" />
                Cho khách ({comments.filter((c) => !c.is_internal).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mb-4 rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-center text-xs text-slate-500">
          {channel === "internal"
            ? "Chưa có bình luận nội bộ."
            : "Chưa có bình luận cho khách."}
        </p>
      ) : (
        <ul className="mb-4 space-y-3">
          {filtered.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              isOwn={c.author_id === currentUserId}
            />
          ))}
        </ul>
      )}

      {(canPostInternal || canPostCustomer) && (
        <CommentComposer
          taskId={taskId}
          channel={channel}
          canPostInternal={canPostInternal}
          canPostCustomer={canPostCustomer}
        />
      )}
    </section>
  );
}

function CommentRow({
  comment,
  isOwn,
}: {
  comment: TaskCommentItem;
  isOwn: boolean;
}) {
  const initials = (comment.author?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(-2)
    .join("")
    .toUpperCase();
  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        isOwn
          ? "border-blue-100 bg-blue-50/30"
          : "border-slate-200 bg-slate-50/40",
        comment.is_internal
          ? "border-l-4 border-l-slate-400"
          : "border-l-4 border-l-emerald-400",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-slate-900">
              {comment.author?.full_name ?? "(người dùng đã xoá)"}
            </span>
            <span className="text-xs text-slate-500">
              {format(new Date(comment.created_at), "HH:mm · dd/MM/yyyy", {
                locale: vi,
              })}
            </span>
            {comment.is_internal ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                <EyeOff className="h-2.5 w-2.5" />
                Nội bộ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                <Eye className="h-2.5 w-2.5" />
                Cho khách
              </span>
            )}
          </div>
          <CommentBody
            body={comment.body}
            className="mt-1 text-sm text-slate-700"
          />
        </div>
      </div>
    </li>
  );
}

function CommentComposer({
  taskId,
  channel,
  canPostInternal,
  canPostCustomer,
}: {
  taskId: string;
  channel: Channel;
  canPostInternal: boolean;
  canPostCustomer: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<Map<string, string>>(new Map());
  const [isPending, startTransition] = useTransition();

  // Customer can only post to customer channel; internal can pick.
  const targetChannel = canPostInternal ? channel : "customer";

  const onSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error("Nội dung không được để trống");
      return;
    }
    const serialized = serializeMentions(trimmed, mentions);
    startTransition(async () => {
      const r = canPostInternal
        ? await addTaskCommentAction(taskId, {
            body: serialized,
            is_internal: targetChannel === "internal",
          })
        : await addCustomerTaskCommentAction(taskId, serialized);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setBody("");
      setMentions(new Map());
      toast.success("Đã gửi bình luận");
      router.refresh();
    });
  };

  if (!canPostInternal && !canPostCustomer) return null;

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-3",
        targetChannel === "internal"
          ? "border-slate-200 bg-slate-50/30"
          : "border-emerald-200 bg-emerald-50/30",
      )}
    >
      <MentionTextarea
        rows={3}
        placeholder={
          targetChannel === "internal"
            ? "Bình luận nội bộ — gõ @ để tag nhân viên..."
            : "Bình luận cho khách — khách hàng sẽ thấy..."
        }
        value={body}
        onChange={setBody}
        mentions={mentions}
        onMentionsChange={setMentions}
        enableMention={canPostInternal}
        className="bg-white"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {targetChannel === "internal" ? (
            <>
              <EyeOff className="mr-1 inline h-3 w-3" />
              Khách KHÔNG thấy bình luận này.
            </>
          ) : (
            <>
              <Eye className="mr-1 inline h-3 w-3" />
              Khách hàng sẽ thấy bình luận này.
            </>
          )}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={isPending || !body.trim()}
        >
          {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          <Send className="mr-1 h-3.5 w-3.5" /> Gửi
        </Button>
      </div>
    </div>
  );
}
