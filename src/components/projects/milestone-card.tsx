"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Loader2,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MentionTextarea } from "@/components/comments/mention-textarea";
import { CommentBody } from "@/components/comments/comment-body";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MILESTONE_STATUS_OPTIONS,
  type UpdateMilestoneInput,
} from "@/lib/validation/milestones";
import {
  addMilestoneCommentAction,
  deleteMilestoneCommentAction,
  updateMilestoneAction,
} from "@/app/(dashboard)/projects/[id]/milestone-actions";
import { MilestoneCompleteDialog } from "./milestone-complete-dialog";
import { MilestoneCompletionPanel } from "./milestone-completion-panel";
import type {
  MilestoneCommentItem,
  MilestoneCompletionItem,
} from "@/lib/queries/milestones";
import type { MilestoneRow, TaskRow } from "@/lib/database.types";

const STATUS_TONE: Record<
  string,
  { dot: string; pill: string; label: string }
> = {
  completed: {
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    label: "Đã hoàn thành",
  },
  active: {
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 ring-blue-200",
    label: "Đang thực hiện",
  },
  awaiting_customer: {
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700 ring-amber-200",
    label: "Chờ phản hồi",
  },
  awaiting_review: {
    dot: "bg-violet-500",
    pill: "bg-violet-50 text-violet-700 ring-violet-200",
    label: "Chờ duyệt",
  },
  paused: {
    dot: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700 ring-rose-200",
    label: "Tạm dừng",
  },
  not_started: {
    dot: "bg-slate-300",
    pill: "bg-slate-50 text-slate-600 ring-slate-200",
    label: "Sắp tới",
  },
};

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "Mới tạo",
  assigned: "Đã giao",
  in_progress: "Đang làm",
  blocked: "Bị chặn",
  awaiting_review: "Chờ duyệt",
  awaiting_customer: "Chờ khách",
  returned: "Trả về",
  done: "Hoàn thành",
  cancelled: "Đã huỷ",
};

const TASK_STATUS_TONE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  assigned: "bg-sky-50 text-sky-700",
  in_progress: "bg-blue-50 text-blue-700",
  blocked: "bg-rose-50 text-rose-700",
  awaiting_review: "bg-violet-50 text-violet-700",
  awaiting_customer: "bg-amber-50 text-amber-700",
  returned: "bg-orange-50 text-orange-700",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

type Props = {
  milestone: MilestoneRow;
  /** Tasks thuộc milestone này (đã filter milestone_id ở parent) */
  tasks: TaskRow[];
  comments: MilestoneCommentItem[];
  /** Active completion (nếu milestone đã được báo hoàn thành và chưa
   *  bị undone/reopened). Render ra evidence panel ở phần expand. */
  completion: MilestoneCompletionItem | null;
  currentUserId: string;
  /** company_id để build storage path khi upload proof attachments. */
  companyId: string | null;
  /** super_admin / admin có nút "Mở lại" + được bypass quy tắc 5 phút. */
  isAdmin: boolean;
  /** Index trong list, dùng để hide divider của item cuối */
  isLast: boolean;
};

export function MilestoneCard({
  milestone,
  tasks,
  comments,
  completion,
  currentUserId,
  companyId,
  isAdmin,
  isLast: _isLast,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  // Phương án C: tasks (đầu việc) ẩn mặc định trong milestone card.
  // Click "Hiện đầu việc" mới expand — đỡ clutter cho admin/PM nhìn tổng quan.
  const [showTasks, setShowTasks] = useState(false);
  const tone = STATUS_TONE[milestone.status] ?? STATUS_TONE.not_started;
  const isCompleted = milestone.status === "completed" && completion !== null;

  return (
    <li className="relative">
      {/* Dot trên timeline */}
      <span
        className={cn(
          "absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white",
          tone.dot,
        )}
      >
        {milestone.status === "completed" && (
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        )}
      </span>

      {/* Header (luôn hiện) — click để toggle expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="-mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50/80"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {milestone.code && (
              <span className="mr-1.5 font-mono text-xs text-slate-500">
                {milestone.code}
              </span>
            )}
            {milestone.title}
          </p>
          {milestone.starts_at && milestone.ends_at && (
            <p className="mt-0.5 text-xs text-slate-500">
              {format(new Date(milestone.starts_at), "dd/MM")} —{" "}
              {format(new Date(milestone.ends_at), "dd/MM/yyyy")}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {tasks.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              <ListChecks className="h-3 w-3" />
              {tasks.length}
            </span>
          )}
          {comments.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
              <MessageSquare className="h-3 w-3" />
              {comments.length}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              tone.pill,
            )}
          >
            {tone.label}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {milestone.status === "active" && !expanded && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${milestone.progress_percent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-600">
            {milestone.progress_percent}%
          </span>
        </div>
      )}

      {/* Expanded panel: edit form + tasks + comments */}
      {expanded && (
        <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50/40 p-4">
          {/* Completion panel — hiện khi milestone đã được nghiệm thu */}
          {isCompleted && completion && (
            <MilestoneCompletionPanel
              completion={completion}
              milestoneId={milestone.id}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          )}

          {/* Edit/View toggle (ẩn khi đã completed — tránh đổi status nhầm,
              admin muốn revert thì bấm "Mở lại" trong completion panel) */}
          {!isCompleted && (
            <>
              {editing ? (
                <MilestoneEditForm
                  milestone={milestone}
                  onCancel={() => setEditing(false)}
                  onSaved={() => setEditing(false)}
                />
              ) : (
                <MilestoneSummary
                  milestone={milestone}
                  onStartEdit={() => setEditing(true)}
                  onMarkComplete={() => setCompleteDialogOpen(true)}
                />
              )}
            </>
          )}

          {/* Đầu việc trong công việc — collapsed default (phương án C) */}
          {tasks.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setShowTasks((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                {showTasks ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {showTasks ? "Ẩn" : "Hiện"} đầu việc chi tiết ({tasks.length})
              </button>
              {showTasks && <MilestoneTasks tasks={tasks} />}
            </div>
          )}

          {/* Thread bình luận */}
          <MilestoneComments
            milestoneId={milestone.id}
            comments={comments}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* Dialog báo hoàn thành — render ngoài expanded để không unmount khi
          panel close vì lỡ tay */}
      <MilestoneCompleteDialog
        milestoneId={milestone.id}
        milestoneTitle={milestone.title}
        companyId={companyId}
        open={completeDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
      />
    </li>
  );
}

function MilestoneSummary({
  milestone,
  onStartEdit,
  onMarkComplete,
}: {
  milestone: MilestoneRow;
  onStartEdit: () => void;
  onMarkComplete: () => void;
}) {
  return (
    <div className="space-y-3">
      {milestone.description && (
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {milestone.description}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Trạng thái">
          {STATUS_TONE[milestone.status]?.label ?? milestone.status}
        </Field>
        <Field label="Tiến độ">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${milestone.progress_percent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-700">
              {milestone.progress_percent}%
            </span>
          </div>
        </Field>
        <Field label="Thời gian">
          <span className="inline-flex items-center gap-1 text-xs text-slate-700">
            <Calendar className="h-3 w-3 text-slate-400" />
            {milestone.starts_at && milestone.ends_at
              ? `${format(new Date(milestone.starts_at), "dd/MM")} — ${format(
                  new Date(milestone.ends_at),
                  "dd/MM/yyyy",
                )}`
              : "—"}
          </span>
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onStartEdit}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Chỉnh sửa
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onMarkComplete}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Đánh dấu hoàn thành
        </Button>
      </div>
    </div>
  );
}

function MilestoneEditForm({
  milestone,
  onCancel,
  onSaved,
}: {
  milestone: MilestoneRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<UpdateMilestoneInput>({
    title: milestone.title,
    description: milestone.description ?? "",
    status: milestone.status,
    progress_percent: milestone.progress_percent,
    starts_at: milestone.starts_at ?? "",
    ends_at: milestone.ends_at ?? "",
  });

  const submit = () => {
    startTransition(async () => {
      const result = await updateMilestoneAction(milestone.id, form);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã cập nhật công việc");
      router.refresh();
      onSaved();
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-700">Tên công việc *</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          disabled={isPending}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-700">Mô tả</Label>
        <Textarea
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          disabled={isPending}
          placeholder="Ghi chú nội bộ về giai đoạn này..."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Trạng thái *</Label>
          <Select
            value={form.status}
            onValueChange={(v) =>
              setForm({ ...form, status: v as UpdateMilestoneInput["status"] })
            }
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn">
                {(value: string | null) =>
                  MILESTONE_STATUS_OPTIONS.find((o) => o.value === value)
                    ?.label ?? "—"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/* Bỏ "completed" khỏi dropdown — phải qua nút "Đánh dấu
                  hoàn thành" để có evidence. Nếu milestone đang
                  completed (form mở từ trạng thái cũ) thì vẫn hiện
                  option để Select không broken. */}
              {MILESTONE_STATUS_OPTIONS.filter(
                (o) =>
                  o.value !== "completed" || milestone.status === "completed",
              ).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-slate-500">
            Để hoàn thành: dùng nút <strong>Đánh dấu hoàn thành</strong>{" "}
            (cần đính kèm bằng chứng nghiệm thu)
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">
            Tiến độ ({form.progress_percent}%)
          </Label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.progress_percent}
            onChange={(e) =>
              setForm({ ...form, progress_percent: Number(e.target.value) })
            }
            disabled={isPending}
            className="h-9 w-full cursor-pointer accent-blue-600"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Bắt đầu</Label>
          <Input
            type="date"
            value={form.starts_at ?? ""}
            onChange={(e) =>
              setForm({ ...form, starts_at: e.target.value || null })
            }
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5 sm:col-start-3">
          <Label className="text-xs font-medium text-slate-700">Kết thúc</Label>
          <Input
            type="date"
            value={form.ends_at ?? ""}
            onChange={(e) =>
              setForm({ ...form, ends_at: e.target.value || null })
            }
            disabled={isPending}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Huỷ
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          )}
          Lưu
        </Button>
      </div>
    </div>
  );
}

function MilestoneTasks({ tasks }: { tasks: TaskRow[] }) {
  // Header (count + toggle) đã render ở parent (MilestoneCard) rồi —
  // ở đây chỉ render danh sách
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
          >
            <a
              href={`/tasks/${t.id}`}
              className="min-w-0 flex-1 truncate text-sm text-slate-800 hover:text-blue-700"
            >
              {t.title}
            </a>
            <span
              className={cn(
                "inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                TASK_STATUS_TONE[t.status] ?? "bg-slate-100 text-slate-700",
              )}
            >
              {TASK_STATUS_LABEL[t.status] ?? t.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MilestoneComments({
  milestoneId,
  comments,
  currentUserId,
}: {
  milestoneId: string;
  comments: MilestoneCommentItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addMilestoneCommentAction({
        milestone_id: milestoneId,
        body: trimmed,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setBody("");
      toast.success("Đã đăng bình luận");
      router.refresh();
    });
  };

  const remove = (commentId: string) => {
    if (!confirm("Xoá bình luận này?")) return;
    startTransition(async () => {
      const result = await deleteMilestoneCommentAction(commentId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã xoá");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      <p className="text-xs font-semibold text-slate-700">
        Bình luận ({comments.length})
      </p>
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-slate-200 bg-white p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-slate-900">
                  {c.author?.full_name ?? "(không rõ)"}
                </p>
                <div className="flex items-center gap-2">
                  <time
                    className="text-[10px] text-slate-400"
                    title={format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}
                  >
                    {formatDistanceToNow(new Date(c.created_at), {
                      addSuffix: true,
                      locale: vi,
                    })}
                  </time>
                  {c.author?.id === currentUserId && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Xoá bình luận"
                      disabled={isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <CommentBody
                body={c.body}
                currentUserId={currentUserId}
                className="mt-1 text-sm text-slate-700"
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <MentionTextarea
          rows={2}
          value={body}
          onChange={setBody}
          placeholder="Viết bình luận... gõ @ để tag nhân viên"
          disabled={isPending}
          className="resize-none"
        />
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={isPending || !body.trim()}
          className="self-end bg-blue-600 hover:bg-blue-700"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}
