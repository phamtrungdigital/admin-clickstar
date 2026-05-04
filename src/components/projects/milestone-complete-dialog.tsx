"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { completeMilestoneAction } from "@/app/(dashboard)/projects/[id]/milestone-actions";
import type {
  MilestoneAttachment,
  MilestoneLink,
} from "@/lib/queries/milestones";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB / file
const BUCKET = "documents";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function MilestoneCompleteDialog({
  milestoneId,
  milestoneTitle,
  companyId,
  open,
  onClose,
}: {
  milestoneId: string;
  milestoneTitle: string;
  /** Cần company_id để build path upload — milestone qua project. */
  companyId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [attachments, setAttachments] = useState<MilestoneAttachment[]>([]);
  const [links, setLinks] = useState<MilestoneLink[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const reset = () => {
    setSummary("");
    setAttachments([]);
    setLinks([]);
    setLinkInput("");
    setLinkLabel("");
  };

  const upload = async (files: File[]) => {
    if (!companyId) {
      toast.error("Không xác định được company của project");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const uploaded: MilestoneAttachment[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" quá ${MAX_BYTES / 1024 / 1024} MB`);
        continue;
      }
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `companies/${companyId}/milestones/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
        cacheControl: "3600",
      });
      if (error) {
        toast.error(`Upload "${file.name}" lỗi: ${error.message}`);
        continue;
      }
      uploaded.push({
        path,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size: file.size,
      });
    }
    if (uploaded.length > 0) {
      setAttachments((prev) => [...prev, ...uploaded]);
    }
    setUploading(false);
  };

  const removeAttachment = async (path: string) => {
    // Best-effort xoá file storage; nếu fail vẫn remove khỏi state
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error("URL không hợp lệ — phải bắt đầu http:// hoặc https://");
      return;
    }
    setLinks((prev) => [
      ...prev,
      { url, ...(linkLabel.trim() ? { label: linkLabel.trim() } : {}) },
    ]);
    setLinkInput("");
    setLinkLabel("");
  };

  const removeLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = () => {
    if (summary.trim().length < 10) {
      toast.error("Mô tả nghiệm thu cần ít nhất 10 ký tự");
      return;
    }
    if (attachments.length + links.length === 0) {
      toast.error("Cần ít nhất 1 file hoặc 1 link làm bằng chứng");
      return;
    }
    startTransition(async () => {
      const result = await completeMilestoneAction(milestoneId, {
        summary: summary.trim(),
        attachments,
        links,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã báo hoàn thành — admin & PM đã được thông báo");
      reset();
      onClose();
      router.refresh();
    });
  };

  const totalEvidence = attachments.length + links.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Đánh dấu hoàn thành
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Công việc:{" "}
              <span className="font-medium text-slate-700">
                {milestoneTitle}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isSubmitting || uploading) return;
              reset();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Mô tả nghiệm thu */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Mô tả nghiệm thu *
            </Label>
            <Textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={isSubmitting}
              placeholder="VD: Đã hoàn thành thiết kế UI website. Khách OK qua Zalo ngày 09/05. File design + screenshot demo phía dưới..."
            />
            <p className="text-xs text-slate-500">
              Tối thiểu 10 ký tự — context về việc đã làm + bằng chứng nào kèm
              theo.
            </p>
          </div>

          {/* Tệp đính kèm */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Tệp đính kèm ({attachments.length})
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length > 0) upload(files);
              }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,image/*"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isSubmitting}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Paperclip className="mr-1.5 h-3.5 w-3.5" />
              )}
              Chọn file (PDF, Word, Excel, ZIP, ảnh — tối đa 20MB/file)
            </Button>
            {attachments.length > 0 && (
              <ul className="space-y-1.5">
                {attachments.map((a) => {
                  const isImage = a.content_type.startsWith("image/");
                  return (
                    <li
                      key={a.path}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm"
                    >
                      {isImage ? (
                        <ImageIcon className="h-4 w-4 flex-shrink-0 text-violet-600" />
                      ) : (
                        <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-slate-700">
                        {a.filename}
                      </span>
                      <span className="flex-shrink-0 text-xs text-slate-500">
                        {formatBytes(a.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.path)}
                        disabled={isSubmitting}
                        className="text-slate-400 hover:text-rose-600"
                        aria-label="Xoá"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Links */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Liên kết ({links.length})
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="https://figma.com/... hoặc https://drive.google.com/..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 min-w-[200px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
              />
              <Input
                placeholder="Tên hiển thị (tuỳ chọn)"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                disabled={isSubmitting}
                className="w-[180px]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLink}
                disabled={!linkInput.trim() || isSubmitting}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                Thêm
              </Button>
            </div>
            {links.length > 0 && (
              <ul className="space-y-1.5">
                {links.map((l, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm"
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
                    <button
                      type="button"
                      onClick={() => removeLink(idx)}
                      disabled={isSubmitting}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Xoá"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Trạng thái requirement */}
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-xs",
              totalEvidence === 0
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800",
            )}
          >
            {totalEvidence === 0 ? (
              <>⚠️ Cần ít nhất <strong>1 file</strong> hoặc <strong>1 link</strong> làm bằng chứng nghiệm thu.</>
            ) : (
              <>
                ✓ Đã có {attachments.length} file + {links.length} link · sẵn
                sàng gửi
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/50 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={isSubmitting || uploading}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={isSubmitting || uploading || totalEvidence === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Báo hoàn thành
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Icon-only Send variant — tham khảo cho future redesigns. Ko dùng ở
 * dialog hiện tại nhưng giữ import để đỡ lint warning.
 */
void Send;
