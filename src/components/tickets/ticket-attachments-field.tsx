"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
const SIGNED_URL_TTL = 60 * 60;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Imperative handle so the parent can pipe paste events from a textarea
 *  into this field's upload pipeline without lifting state. */
export type TicketAttachmentsFieldHandle = {
  uploadFiles: (files: File[]) => void;
};

export const TicketAttachmentsField = forwardRef<
  TicketAttachmentsFieldHandle,
  {
    companyId: string | null;
    value: TicketAttachment[];
    onChange: (next: TicketAttachment[]) => void;
  }
>(function TicketAttachmentsField({ companyId, value, onChange }, ref) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  // Map path -> displayable URL (object URL for just-uploaded files,
  // signed URL for previously-saved attachments).
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  // Track which paths use object URLs so we can revoke them on cleanup.
  const objectUrlPathsRef = useRef<Set<string>>(new Set());

  // For attachments that arrive via props (edit mode, refresh) and don't yet
  // have a preview URL, fetch signed URLs in batch.
  useEffect(() => {
    const imageAttachments = value.filter((a) =>
      a.content_type.startsWith("image/"),
    );
    const missing = imageAttachments.filter((a) => !previewUrls[a.path]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(
          missing.map((a) => a.path),
          SIGNED_URL_TTL,
        );
      if (cancelled || error || !data) return;
      setPreviewUrls((prev) => {
        const next = { ...prev };
        for (const item of data) {
          if (item.signedUrl && item.path && !next[item.path]) {
            next[item.path] = item.signedUrl;
          }
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [value, previewUrls]);

  // Revoke object URLs on unmount so the browser can free them.
  useEffect(() => {
    const tracked = objectUrlPathsRef.current;
    return () => {
      for (const path of tracked) {
        const url = previewUrls[path];
        if (url) URL.revokeObjectURL(url);
      }
    };
    // Intentionally only on unmount — `previewUrls` captured by ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const newPreviewEntries: [string, string][] = [];
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
      const att: TicketAttachment = {
        path,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size: file.size,
        uploaded_at: new Date().toISOString(),
      };
      uploaded.push(att);
      // Use the local File for instant preview without a signed-URL roundtrip.
      if (att.content_type.startsWith("image/")) {
        const objUrl = URL.createObjectURL(file);
        newPreviewEntries.push([path, objUrl]);
        objectUrlPathsRef.current.add(path);
      }
    }
    setUploadingCount((n) => n - valid.length);
    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
      if (newPreviewEntries.length > 0) {
        setPreviewUrls((prev) => {
          const next = { ...prev };
          for (const [k, v] of newPreviewEntries) next[k] = v;
          return next;
        });
      }
      toast.success(`Đã đính kèm ${uploaded.length} tệp`);
    }
  };

  useImperativeHandle(
    ref,
    () => ({ uploadFiles: (files: File[]) => void upload(files) }),
    // upload depends on companyId / value / onChange — closure is recreated
    // on each render, so keep this aligned with React's expectations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, value, onChange],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void upload(files);
  };

  const extractPasteFiles = (
    items: DataTransferItemList | null,
  ): File[] => {
    if (!items) return [];
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) {
          // Browsers default screenshot pastes to "image.png" — give a unique name.
          const named =
            f.name === "image.png"
              ? new File([f], `screenshot-${Date.now()}.png`, { type: f.type })
              : f;
          files.push(named);
        }
      }
    }
    return files;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const files = extractPasteFiles(e.clipboardData?.items ?? null);
    if (files.length > 0) {
      e.preventDefault();
      void upload(files);
    }
  };

  const remove = (path: string) => {
    onChange(value.filter((a) => a.path !== path));
    if (objectUrlPathsRef.current.has(path)) {
      const url = previewUrls[path];
      if (url) URL.revokeObjectURL(url);
      objectUrlPathsRef.current.delete(path);
    }
    setPreviewUrls((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  return (
    <div
      className="space-y-3"
      onPaste={handlePaste}
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
          Hoặc dán ảnh (Ctrl/Cmd + V) ngay trong ô Mô tả — tối đa 10 MB / tệp
        </span>
        {uploadingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang upload {uploadingCount} tệp...
          </span>
        )}
      </div>

      {value.length > 0 && <AttachmentList value={value} previewUrls={previewUrls} onRemove={remove} />}
    </div>
  );
});

function AttachmentList({
  value,
  previewUrls,
  onRemove,
}: {
  value: TicketAttachment[];
  previewUrls: Record<string, string>;
  onRemove: (path: string) => void;
}) {
  const images = value.filter((a) => a.content_type.startsWith("image/"));
  const others = value.filter((a) => !a.content_type.startsWith("image/"));

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((a) => (
            <ImageThumbnail
              key={a.path}
              att={a}
              url={previewUrls[a.path]}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-2">
          {others.map((a) => (
            <FileRow key={a.path} att={a} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ImageThumbnail({
  att,
  url,
  onRemove,
}: {
  att: TicketAttachment;
  url: string | undefined;
  onRemove: (path: string) => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={att.filename}
          className="aspect-square w-full object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-slate-100">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      )}
      <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-2 py-1 text-[11px] text-white">
        {att.filename}
      </span>
      <button
        type="button"
        aria-label={`Xoá ${att.filename}`}
        onClick={() => onRemove(att.path)}
        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FileRow({
  att,
  onRemove,
}: {
  att: TicketAttachment;
  onRemove: (path: string) => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5",
      )}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        {att.content_type.startsWith("image/") ? (
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
