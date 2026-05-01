"use client";

import { useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TicketAttachment } from "@/lib/database.types";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET = "documents";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function TicketAttachmentsField({
  companyId,
  value,
  onChange,
}: {
  companyId: string | null;
  value: TicketAttachment[];
  onChange: (next: TicketAttachment[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    if (!companyId) {
      toast.error("Vui lòng chọn khách hàng trước khi đính kèm");
      return;
    }
    const valid = files.filter((f) => {
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" quá ${MAX_BYTES / 1024 / 1024} MB`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    const supabase = createClient();
    setUploadingCount((n) => n + valid.length);
    const uploaded: TicketAttachment[] = [];
    for (const file of valid) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `companies/${companyId}/tickets/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
          cacheControl: "3600",
        });
      if (error) {
        toast.error(`Không upload được "${file.name}": ${error.message}`);
        continue;
      }
      uploaded.push({
        path,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size: file.size,
        uploaded_at: new Date().toISOString(),
      });
    }
    setUploadingCount((n) => n - valid.length);
    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
      toast.success(`Đã đính kèm ${uploaded.length} tệp`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void upload(files);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) {
          // Give pasted images a friendlier filename if browser default is "image.png"
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
      void upload(files);
    }
  };

  const remove = (path: string) => {
    onChange(value.filter((a) => a.path !== path));
  };

  return (
    <div
      className="space-y-3"
      onPaste={handlePaste}
      tabIndex={-1}
      role="region"
      aria-label="Tệp đính kèm — dán ảnh trực tiếp tại đây"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingCount > 0}
        >
          <Paperclip className="mr-2 h-4 w-4" />
          Đính kèm tệp
        </Button>
        <span className="text-xs text-slate-500">
          Hoặc dán ảnh (Ctrl/Cmd + V) trực tiếp vào đây — tối đa 10 MB / tệp
        </span>
        {uploadingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang upload {uploadingCount} tệp...
          </span>
        )}
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((att) => (
            <AttachmentRow key={att.path} att={att} onRemove={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachmentRow({
  att,
  onRemove,
}: {
  att: TicketAttachment;
  onRemove: (path: string) => void;
}) {
  const isImage = att.content_type.startsWith("image/");
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5",
      )}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        {isImage ? (
          <ImageIcon className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {att.filename}
        </p>
        <p className="text-xs text-slate-500">{formatBytes(att.size)}</p>
      </div>
      <button
        type="button"
        aria-label={`Xoá ${att.filename}`}
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        onClick={() => onRemove(att.path)}
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
