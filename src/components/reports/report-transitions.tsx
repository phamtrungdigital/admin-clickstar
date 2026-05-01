"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send, X } from "lucide-react";
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
  approveReportAction,
  rejectReportAction,
  submitReportAction,
} from "@/app/(dashboard)/reports/actions";
import type { ReportStatus } from "@/lib/database.types";

export function ReportTransitions({
  reportId,
  status,
  isCreator,
  isAdmin,
}: {
  reportId: string;
  status: ReportStatus;
  isCreator: boolean;
  isAdmin: boolean;
}) {
  const canSubmit =
    (isCreator || isAdmin) &&
    (status === "draft" || status === "rejected");
  const canApprove = isAdmin && status === "pending_approval";
  const canReject = isAdmin && status === "pending_approval";

  if (!canSubmit && !canApprove && !canReject) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Hành động</h3>
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 text-xs text-slate-500">
          {status === "approved"
            ? "Báo cáo đã duyệt — khách đang thấy."
            : status === "pending_approval"
              ? "Đang chờ admin duyệt."
              : "Anh/chị không thể thao tác trên báo cáo này."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Hành động</h3>
      <div className="flex flex-col gap-2">
        {canSubmit && <SubmitButton reportId={reportId} />}
        {canApprove && <ApproveButton reportId={reportId} />}
        {canReject && <RejectButton reportId={reportId} />}
      </div>
    </section>
  );
}

function SubmitButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const r = await submitReportAction(reportId);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          toast.success("Đã submit chờ admin duyệt");
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

function ApproveButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const onConfirm = () => {
    startTransition(async () => {
      const r = await approveReportAction(reportId, { comment });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Đã duyệt — khách đã thấy báo cáo");
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
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" /> Duyệt
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duyệt báo cáo</DialogTitle>
          <DialogDescription>
            Sau khi duyệt, khách sẽ thấy bản này trên portal và nhận thông báo.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Ghi chú (tuỳ chọn)
          </Label>
          <Textarea
            rows={3}
            className="mt-1.5"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="VD: OK, đã review."
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

function RejectButton({ reportId }: { reportId: string }) {
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
      const r = await rejectReportAction(reportId, { reason });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Đã từ chối báo cáo");
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
            className="border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            <X className="mr-1.5 h-3.5 w-3.5" /> Từ chối
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối báo cáo</DialogTitle>
          <DialogDescription>
            PM sẽ nhận thông báo lý do để chỉnh sửa và submit lại.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Lý do từ chối *
          </Label>
          <Textarea
            rows={4}
            className="mt-1.5"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Số liệu KPI chưa khớp với GA — cần sửa đoạn 2."
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
