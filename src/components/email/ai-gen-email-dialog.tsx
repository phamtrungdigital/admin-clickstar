"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { aiGenEmailAction } from "@/app/(dashboard)/email/actions";
import type { AiEmailGenInput } from "@/app/(dashboard)/email/actions";

const KINDS: {
  value: AiEmailGenInput["kind"];
  label: string;
  example: string;
}[] = [
  {
    value: "transactional",
    label: "Thông báo giao dịch",
    example:
      "Email báo khách hàng vừa tạo ticket mới — gửi cho admin/AM xử lý",
  },
  {
    value: "announcement",
    label: "Thông báo",
    example:
      "Thông báo bảo trì hệ thống Clickstar Portal ngày 15/12, downtime 2 giờ",
  },
  {
    value: "invitation",
    label: "Mời họp / sự kiện",
    example: "Mời khách hàng tham gia buổi review báo cáo SEO Q4",
  },
  {
    value: "reminder",
    label: "Nhắc deadline",
    example: "Nhắc khách duyệt báo cáo tháng trước ngày 5",
  },
  {
    value: "congrats",
    label: "Chúc mừng",
    example: "Chúc mừng khách đạt mốc 1000 traffic SEO/ngày",
  },
  { value: "custom", label: "Khác", example: "" },
];

export function AiGenEmailDialog({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: (result: {
    subject: string;
    html: string;
    suggestedName: string;
    suggestedCode: string;
    variableHint: string;
  }) => void;
}) {
  const [kind, setKind] = useState<AiEmailGenInput["kind"]>("transactional");
  const [prompt, setPrompt] = useState("");
  const [isPending, startTransition] = useTransition();

  const example = KINDS.find((k) => k.value === kind)?.example ?? "";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      toast.error("Nhập yêu cầu cho AI");
      return;
    }
    startTransition(async () => {
      const result = await aiGenEmailAction({ prompt: prompt.trim(), kind });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const variableHint = result.data.suggestedVariables
        .map((v) => v.name)
        .join(", ");
      onGenerated({
        subject: result.data.subject,
        html: result.data.html,
        suggestedName: result.data.suggestedName,
        suggestedCode: result.data.suggestedCode,
        variableHint,
      });
      toast.success("AI đã viết xong — review và lưu");
      setPrompt("");
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Tạo email bằng AI
          </DialogTitle>
          <DialogDescription>
            AI sẽ viết tiêu đề + HTML body + suggested name/code/variables.
            Cần có AI integration active ở Cài đặt hệ thống &gt; Tích hợp AI.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Loại email
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    kind === k.value
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Yêu cầu cho AI
            </Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder={
                example ||
                "Mô tả chi tiết: nội dung muốn truyền tải, đối tượng nhận, ngày tháng cụ thể, CTA cần có..."
              }
            />
            {example && (
              <p className="text-xs text-slate-500">
                Ví dụ:{" "}
                <button
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="text-blue-600 underline hover:text-blue-700"
                >
                  {example}
                </button>
              </p>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs text-slate-700">
            💡 AI trả về subject + HTML body + tên template + code + biến gợi
            ý. Em có thể review và chỉnh sửa trước khi lưu.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button
              type="submit"
              disabled={isPending || !prompt.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> AI đang viết...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" /> Tạo email
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
