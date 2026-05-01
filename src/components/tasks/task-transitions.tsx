"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  CornerUpLeft,
  Hourglass,
  Loader2,
  Play,
  Send,
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
import { Textarea } from "@/components/ui/textarea";
import {
  approveTaskAction,
  awaitingCustomerAction,
  blockTaskAction,
  cancelTaskAction,
  returnTaskAction,
  startTaskAction,
  submitForReviewAction,
  unblockTaskAction,
} from "@/app/(dashboard)/tasks/actions";
import type { TaskStatus } from "@/lib/database.types";

export function TaskTransitions({
  taskId,
  status,
  isAssignee,
  isReviewer,
  isAdmin,
}: {
  taskId: string;
  status: TaskStatus;
  isAssignee: boolean;
  isReviewer: boolean;
  isAdmin: boolean;
}) {
  // Compute which actions are available given the current state + role
  const canStart =
    (isAssignee || isAdmin) &&
    ["assigned", "blocked", "returned", "awaiting_customer"].includes(status);
  const canSubmit = (isAssignee || isAdmin) && status === "in_progress";
  const canBlock =
    (isAssignee || isAdmin) &&
    ["assigned", "in_progress", "returned"].includes(status);
  const canUnblock = (isAssignee || isAdmin) && status === "blocked";
  const canAwaitCustomer =
    (isAssignee || isAdmin) && ["assigned", "in_progress"].includes(status);
  const canApprove = (isReviewer || isAdmin) && status === "awaiting_review";
  const canReturn = (isReviewer || isAdmin) && status === "awaiting_review";
  const canCancel =
    isAdmin &&
    !["done", "cancelled"].includes(status);

  const noActions =
    !canStart &&
    !canSubmit &&
    !canBlock &&
    !canUnblock &&
    !canAwaitCustomer &&
    !canApprove &&
    !canReturn &&
    !canCancel;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Hành động</h3>
      {noActions ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 text-xs text-slate-500">
          {status === "done"
            ? "Task đã hoàn thành."
            : status === "cancelled"
              ? "Task đã huỷ."
              : "Anh/chị không phải người phụ trách hoặc reviewer của task này."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {canStart && <StartButton taskId={taskId} />}
          {canSubmit && <SubmitButton taskId={taskId} />}
          {canApprove && <ApproveButton taskId={taskId} />}
          {canReturn && <ReturnButton taskId={taskId} />}
          {canBlock && <BlockButton taskId={taskId} />}
          {canUnblock && <UnblockButton taskId={taskId} />}
          {canAwaitCustomer && <AwaitCustomerButton taskId={taskId} />}
          {canCancel && <CancelButton taskId={taskId} />}
        </div>
      )}
    </section>
  );
}

function StartButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const r = await startTaskAction(taskId);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          toast.success("Đã bắt đầu");
          router.refresh();
        })
      }
      disabled={isPending}
      className="bg-blue-600 text-white hover:bg-blue-700"
    >
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <Play className="mr-1.5 h-3.5 w-3.5" /> Bắt đầu
    </Button>
  );
}

function SubmitButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const r = await submitForReviewAction(taskId);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          toast.success("Đã submit chờ duyệt");
          router.refresh();
        })
      }
      disabled={isPending}
      className="bg-violet-600 text-white hover:bg-violet-700"
    >
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <Send className="mr-1.5 h-3.5 w-3.5" /> Submit chờ duyệt
    </Button>
  );
}

function ApproveButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const r = await approveTaskAction(taskId);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          toast.success("Đã duyệt — task hoàn thành");
          router.refresh();
        })
      }
      disabled={isPending}
      className="bg-emerald-600 text-white hover:bg-emerald-700"
    >
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <Check className="mr-1.5 h-3.5 w-3.5" /> Duyệt
    </Button>
  );
}

function ReturnButton({ taskId }: { taskId: string }) {
  return (
    <ReasonDialog
      title="Trả về task"
      description="NV sẽ nhận thông báo + comment trong task để biết cần sửa gì."
      placeholder="VD: Title chưa khớp với keyword target. Cần làm lại theo file đính kèm."
      buttonLabel="Trả về"
      buttonIcon={CornerUpLeft}
      buttonClass="border-orange-200 text-orange-700 hover:bg-orange-50"
      onConfirm={(reason) => returnTaskAction(taskId, { reason })}
      successMessage="Đã trả về cho NV"
    />
  );
}

function BlockButton({ taskId }: { taskId: string }) {
  return (
    <ReasonDialog
      title="Báo bị chặn"
      description="Sếp/PM sẽ thấy task bị chặn để xử lý input còn thiếu."
      placeholder="VD: Chờ khách cấp quyền truy cập Google Search Console."
      buttonLabel="Bị chặn"
      buttonIcon={Ban}
      buttonClass="border-rose-200 text-rose-700 hover:bg-rose-50"
      onConfirm={(reason) => blockTaskAction(taskId, { reason })}
      successMessage="Đã đánh dấu bị chặn"
    />
  );
}

function UnblockButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() =>
        startTransition(async () => {
          const r = await unblockTaskAction(taskId);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          toast.success("Đã gỡ chặn — quay lại Đang làm");
          router.refresh();
        })
      }
      disabled={isPending}
    >
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <Play className="mr-1.5 h-3.5 w-3.5" /> Gỡ chặn
    </Button>
  );
}

function AwaitCustomerButton({ taskId }: { taskId: string }) {
  return (
    <ReasonDialog
      title="Chờ phản hồi khách"
      description="Task sẽ ở trạng thái chờ khách. Lý do (nếu nhập) sẽ thành comment cho khách."
      placeholder="VD: Cần khách duyệt file Title & Meta."
      buttonLabel="Chờ phản hồi khách"
      buttonIcon={Hourglass}
      buttonClass="border-amber-200 text-amber-700 hover:bg-amber-50"
      onConfirm={(reason) =>
        awaitingCustomerAction(taskId, { reason: reason ?? "" })
      }
      successMessage="Đã đánh dấu chờ phản hồi khách"
      reasonRequired={false}
    />
  );
}

function CancelButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        if (!window.confirm("Huỷ task này? Hành động này được log để truy vết."))
          return;
        startTransition(async () => {
          const r = await cancelTaskAction(taskId);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          toast.success("Đã huỷ task");
          router.refresh();
        });
      }}
      disabled={isPending}
      className="text-slate-500"
    >
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <X className="mr-1.5 h-3.5 w-3.5" /> Huỷ task
    </Button>
  );
}

function ReasonDialog({
  title,
  description,
  placeholder,
  buttonLabel,
  buttonIcon: Icon,
  buttonClass,
  onConfirm,
  successMessage,
  reasonRequired = true,
}: {
  title: string;
  description: string;
  placeholder: string;
  buttonLabel: string;
  buttonIcon: React.ComponentType<{ className?: string }>;
  buttonClass?: string;
  onConfirm: (reason: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  successMessage: string;
  reasonRequired?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const onSubmit = () => {
    if (reasonRequired && !reason.trim()) {
      toast.error("Vui lòng nhập lý do");
      return;
    }
    startTransition(async () => {
      const r = await onConfirm(reason);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(successMessage);
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
            variant="outline"
            className={buttonClass}
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {buttonLabel}
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Lý do {reasonRequired ? "*" : "(tuỳ chọn)"}
          </Label>
          <Textarea
            rows={4}
            className="mt-1.5"
            placeholder={placeholder}
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
            onClick={onSubmit}
            disabled={isPending || (reasonRequired && !reason.trim())}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
