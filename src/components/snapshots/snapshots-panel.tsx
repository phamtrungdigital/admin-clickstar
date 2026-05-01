"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertCircle,
  Camera,
  Check,
  Clock,
  History,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  approveSnapshotAction,
  createSnapshotAction,
  rejectSnapshotAction,
  rollbackSnapshotAction,
} from "@/app/(dashboard)/projects/snapshots-actions";
import type { SnapshotListItem } from "@/lib/queries/snapshots";
import {
  SNAPSHOT_TYPE_DESCRIPTION,
  SNAPSHOT_TYPE_LABEL,
} from "@/lib/validation/snapshots";
import type { SnapshotStatus, SnapshotType } from "@/lib/database.types";

const STATUS_TONE: Record<SnapshotStatus, { tone: string; label: string }> = {
  draft: {
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
    label: "Nháp",
  },
  pending_approval: {
    tone: "bg-amber-50 text-amber-700 ring-amber-200",
    label: "Chờ duyệt",
  },
  approved: {
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    label: "Đã duyệt",
  },
  auto_published: {
    tone: "bg-sky-50 text-sky-700 ring-sky-200",
    label: "Auto-publish",
  },
  rejected: {
    tone: "bg-rose-50 text-rose-700 ring-rose-200",
    label: "Đã từ chối",
  },
  rolled_back: {
    tone: "bg-orange-50 text-orange-700 ring-orange-200",
    label: "Đã rollback",
  },
};

export function SnapshotsPanel({
  projectId,
  snapshots,
  canApprove,
}: {
  projectId: string;
  snapshots: SnapshotListItem[];
  canApprove: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Camera className="h-4 w-4 text-blue-600" />
            Snapshot ({snapshots.length})
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Khách chỉ thấy dữ liệu trong snapshot đã duyệt. Snapshot tuần
            auto-publish sau 24h nếu admin không phản hồi (PRD §7).
          </p>
        </div>
        <CreateSnapshotButton projectId={projectId} />
      </div>

      {snapshots.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
          Chưa có snapshot nào — khách hiện chưa thấy gì cả.
          <br />
          Bấm <strong>"Tạo snapshot"</strong> để publish bản tổng hợp đầu tiên.
        </div>
      ) : (
        <ul className="space-y-3">
          {snapshots.map((s) => (
            <SnapshotRow
              key={s.id}
              snapshot={s}
              canApprove={canApprove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateSnapshotButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<SnapshotType>("weekly");
  const [notes, setNotes] = useState("");

  const onSubmit = () => {
    startTransition(async () => {
      const result = await createSnapshotAction({
        project_id: projectId,
        type,
        notes,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã tạo snapshot, đang chờ duyệt");
      setOpen(false);
      setNotes("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm">
            <Camera className="mr-1.5 h-3.5 w-3.5" /> Tạo snapshot
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo snapshot</DialogTitle>
          <DialogDescription>
            Snapshot là ảnh chụp dữ liệu customer-visible tại thời điểm tạo.
            Sau khi admin duyệt, khách sẽ thấy bản này trên portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Loại snapshot *
            </Label>
            <Select
              value={type}
              onValueChange={(v) => v && setType(v as SnapshotType)}
            >
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue>
                  {(value: string | null) =>
                    value
                      ? SNAPSHOT_TYPE_LABEL[value as SnapshotType] ?? value
                      : null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["weekly", "milestone", "deliverable", "extra_task"] as const).map(
                  (t) => (
                    <SelectItem key={t} value={t}>
                      {SNAPSHOT_TYPE_LABEL[t]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-slate-500">
              {SNAPSHOT_TYPE_DESCRIPTION[type]}
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Ghi chú cho admin/khách
            </Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              placeholder="VD: Hoàn thành 3 task M3 tuần này. Đề nghị anh sếp duyệt để khách xem được."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo snapshot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SnapshotRow({
  snapshot,
  canApprove,
}: {
  snapshot: SnapshotListItem;
  canApprove: boolean;
}) {
  const tone = STATUS_TONE[snapshot.status];
  const isPending = snapshot.status === "pending_approval";
  const isPublished =
    snapshot.status === "approved" || snapshot.status === "auto_published";
  const canRollback =
    isPublished &&
    snapshot.rollback_until &&
    new Date(snapshot.rollback_until) > new Date();

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {SNAPSHOT_TYPE_LABEL[snapshot.type]}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                tone.tone,
              )}
            >
              {tone.label}
            </span>
            {snapshot.auto_publish_at && isPending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                <Clock className="h-2.5 w-2.5" />
                Auto-publish{" "}
                {formatDistanceToNow(new Date(snapshot.auto_publish_at), {
                  locale: vi,
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            <History className="mr-1 inline h-3 w-3" />
            Tạo {format(new Date(snapshot.created_at), "dd/MM/yyyy HH:mm")}
            {snapshot.created_by_profile &&
              ` bởi ${snapshot.created_by_profile.full_name}`}
            {snapshot.approved_at && (
              <>
                {" · "}
                {snapshot.status === "approved"
                  ? "Duyệt"
                  : snapshot.status === "rejected"
                    ? "Từ chối"
                    : "Auto-publish"}{" "}
                {format(new Date(snapshot.approved_at), "dd/MM/yyyy HH:mm")}
                {snapshot.approved_by_profile &&
                  snapshot.status === "approved" &&
                  ` bởi ${snapshot.approved_by_profile.full_name}`}
              </>
            )}
          </p>
          {snapshot.notes && (
            <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {snapshot.notes}
            </p>
          )}
          {snapshot.rejected_reason && (
            <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <strong>Lý do {snapshot.status === "rolled_back" ? "rollback" : "từ chối"}:</strong>{" "}
              {snapshot.rejected_reason}
            </p>
          )}
          <SnapshotStats payload={snapshot.payload} />
        </div>
        {canApprove && (
          <div className="flex flex-shrink-0 items-center gap-2">
            {isPending && (
              <>
                <ApproveButton snapshotId={snapshot.id} />
                <RejectButton snapshotId={snapshot.id} />
              </>
            )}
            {canRollback && (
              <RollbackButton snapshotId={snapshot.id} />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function SnapshotStats({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const milestones = Array.isArray(p.milestones) ? p.milestones.length : null;
  const tasks = Array.isArray(p.tasks) ? p.tasks.length : null;
  const project = p.project as { progress_percent?: number } | undefined;
  if (milestones === null && tasks === null) return null;
  return (
    <p className="mt-2 inline-flex items-center gap-3 text-xs text-slate-500">
      {project?.progress_percent !== undefined && (
        <span>
          <ShieldCheck className="mr-1 inline h-3 w-3" />
          Tiến độ: <strong>{project.progress_percent}%</strong>
        </span>
      )}
      {milestones !== null && (
        <span>
          <Sparkles className="mr-1 inline h-3 w-3" />
          {milestones} milestone
        </span>
      )}
      {tasks !== null && <span>{tasks} task customer-visible</span>}
    </p>
  );
}

function ApproveButton({ snapshotId }: { snapshotId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const r = await approveSnapshotAction(snapshotId, { comment });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Đã duyệt snapshot — khách đã thấy bản này");
      setOpen(false);
      setComment("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Duyệt
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duyệt snapshot</DialogTitle>
          <DialogDescription>
            Sau khi duyệt, khách sẽ thấy bản này trên portal. Có thể rollback
            trong 7 ngày.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Ghi chú thêm (tuỳ chọn)
          </Label>
          <Textarea
            rows={3}
            className="mt-1.5"
            placeholder="VD: Đã review, OK publish."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận duyệt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectButton({ snapshotId }: { snapshotId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    if (!reason.trim()) {
      toast.error("Nhập lý do từ chối");
      return;
    }
    startTransition(async () => {
      const r = await rejectSnapshotAction(snapshotId, { reason });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Đã từ chối snapshot");
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Từ chối
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối snapshot</DialogTitle>
          <DialogDescription>
            PM sẽ nhận thông báo lý do để chỉnh sửa và tạo snapshot mới.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Lý do từ chối *
          </Label>
          <Textarea
            rows={4}
            className="mt-1.5"
            placeholder="VD: Tiến độ chưa khớp với kế hoạch — cần update task M3 trước khi public."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !reason.trim()}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận từ chối
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RollbackButton({ snapshotId }: { snapshotId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    if (!reason.trim()) {
      toast.error("Nhập lý do rollback");
      return;
    }
    startTransition(async () => {
      const r = await rollbackSnapshotAction(snapshotId, { reason });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Đã rollback — khách không còn thấy bản này");
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Rollback
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rollback snapshot</DialogTitle>
          <DialogDescription>
            <AlertCircle className="mr-1 inline h-3.5 w-3.5 text-amber-600" />
            Khách sẽ không còn thấy bản này. Tác vụ này được log để truy vết.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Lý do rollback *
          </Label>
          <Textarea
            rows={4}
            className="mt-1.5"
            placeholder="VD: Phát hiện thông tin nhạy cảm bị lộ trong snapshot."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !reason.trim()}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
