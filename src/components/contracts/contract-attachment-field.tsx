"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLink, FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type AttachmentValue = {
  url: string;
  filename: string;
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function ContractAttachmentField({
  companyId,
  value,
  onChange,
}: {
  companyId: string | null;
  value: AttachmentValue;
  onChange: (next: AttachmentValue) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [externalUrl, setExternalUrl] = useState(
    value.url && /^https?:\/\//.test(value.url) ? value.url : "",
  );

  const isUploaded = value.url && !/^https?:\/\//.test(value.url);
  const isExternal = value.url && /^https?:\/\//.test(value.url);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const inputEl = e.target;

    if (!companyId) {
      toast.error("Vui lòng chọn khách hàng trước khi upload");
      inputEl.value = "";
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Chỉ hỗ trợ tệp PDF");
      inputEl.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Tệp quá ${MAX_BYTES / 1024 / 1024} MB`);
      inputEl.value = "";
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const path = `companies/${companyId}/contracts/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("documents")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "3600",
        });

      if (error) {
        toast.error(`Không upload được: ${error.message}`);
        inputEl.value = "";
        return;
      }

      onChange({ url: path, filename: file.name });
      setExternalUrl("");
      toast.success("Đã upload tệp PDF");
      inputEl.value = "";
    });
  };

  const applyExternalUrl = () => {
    const url = externalUrl.trim();
    if (!url) {
      onChange({ url: "", filename: "" });
      return;
    }
    if (!/^https?:\/\//.test(url)) {
      toast.error("Đường dẫn phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    const filename = url.split("/").pop() || "Đường dẫn ngoài";
    onChange({ url, filename });
  };

  const clear = () => {
    onChange({ url: "", filename: "" });
    setExternalUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {value.url && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border bg-white p-3",
            isUploaded ? "border-emerald-200" : "border-blue-200",
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md",
              isUploaded
                ? "bg-emerald-50 text-emerald-600"
                : "bg-blue-50 text-blue-600",
            )}
          >
            {isUploaded ? (
              <FileText className="h-4 w-4" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {value.filename || "Tệp đính kèm"}
            </p>
            <p className="text-[11px] text-slate-500">
              {isUploaded ? "Đã upload • Supabase Storage" : "Đường dẫn ngoài"}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Xoá tệp"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs font-medium text-slate-500">Upload PDF</Label>
          <div className="mt-1 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending || !companyId}
              className="w-full"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {isPending ? "Đang upload..." : "Chọn tệp PDF"}
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            PDF tối đa 10 MB. {!companyId && "Chọn khách hàng trước."}
          </p>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-500">
            Hoặc đường dẫn online
          </Label>
          <div className="mt-1 flex gap-2">
            <Input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://drive.google.com/file/..."
              onBlur={applyExternalUrl}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyExternalUrl();
                }
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Hỗ trợ link Google Drive, Dropbox, OneDrive, ...
          </p>
        </div>
      </div>

      {isExternal && externalUrl !== value.url && (
        <p className="text-[11px] text-amber-600">
          Bấm Enter hoặc click ra ngoài ô để áp dụng đường dẫn mới.
        </p>
      )}
    </div>
  );
}
