"use client";

/**
 * LiveEmailPreview — inline iframe preview cho email body. Cập nhật real-time
 * khi user gõ. useDeferredValue tránh jank khi gõ nhanh (iframe reload thường
 * xuyên sẽ flicker).
 *
 * Variables được render với sample value (tên placeholder dạng `[var]` nếu
 * sample chưa khai báo) — admin xem được nội dung gần thật trước khi gửi.
 */

import { useDeferredValue, useMemo, useState } from "react";
import { Eye, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderEmailTemplate } from "@/lib/email/render";

export type PreviewVariable = {
  name: string;
  sample?: string;
};

interface Props {
  subject: string;
  htmlBody: string;
  variables: PreviewVariable[];
  className?: string;
  /** Chiều cao tối thiểu của iframe area (CSS) — default '560px'. */
  minHeight?: string;
}

export function LiveEmailPreview({
  subject,
  htmlBody,
  variables,
  className,
  minHeight = "560px",
}: Props) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  // Defer expensive iframe re-render — gõ nhanh không gây jank
  const deferredHtml = useDeferredValue(htmlBody);
  const deferredSubject = useDeferredValue(subject);

  const sampleDict = useMemo(() => {
    const out: Record<string, string> = {};
    for (const v of variables) {
      out[v.name] = v.sample?.trim() ? v.sample : `[${v.name}]`;
    }
    return out;
  }, [variables]);

  const renderedSubject = useMemo(
    () => renderEmailTemplate(deferredSubject, sampleDict),
    [deferredSubject, sampleDict],
  );
  const renderedHtml = useMemo(
    () => renderEmailTemplate(deferredHtml, sampleDict),
    [deferredHtml, sampleDict],
  );

  const iframeSrc = useMemo(() => {
    const body = renderedHtml.trim()
      ? renderedHtml
      : `<div style="padding:64px 24px;color:#94a3b8;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
           <p style="margin:0;font-size:14px">Chưa có nội dung — gõ vào editor để xem trước</p>
         </div>`;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <base target="_blank" />
  <style>html,body{margin:0;padding:0}body{background:#f4f6f9}</style>
</head>
<body>${body}</body>
</html>`;
  }, [renderedHtml]);

  return (
    <div
      className={cn(
        "border-slate-200 bg-white flex flex-col overflow-hidden rounded-xl border shadow-sm",
        className,
      )}
    >
      {/* Mini header với device toggle */}
      <div className="border-slate-200 bg-slate-50 flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Eye className="text-blue-600 h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium">Xem trước thực tế</span>
          <span className="text-slate-500 hidden text-[11px] sm:inline">• tự cập nhật</span>
        </div>
        <div className="border-slate-200 bg-white flex rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            aria-label="Xem trên máy tính"
            title="Máy tính (640px)"
            className={cn(
              "flex h-6 w-7 items-center justify-center rounded transition-colors",
              device === "desktop"
                ? "bg-slate-100 text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            aria-label="Xem trên điện thoại"
            title="Điện thoại (360px)"
            className={cn(
              "flex h-6 w-7 items-center justify-center rounded transition-colors",
              device === "mobile"
                ? "bg-slate-100 text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Subject preview line — giả lập inbox header */}
      <div className="border-slate-200 bg-white border-b px-3.5 py-2.5">
        <div className="text-slate-500 text-[10px] font-medium uppercase tracking-wide">
          Tiêu đề
        </div>
        <div
          className="text-slate-900 truncate text-xs font-semibold leading-snug"
          title={renderedSubject}
        >
          {renderedSubject || <span className="text-slate-500 italic font-normal">(chưa nhập)</span>}
        </div>
      </div>

      {/* Iframe trong khung mô phỏng inbox */}
      <div className="flex-1 overflow-y-auto bg-slate-100 p-3">
        <div
          className={cn(
            "mx-auto overflow-hidden bg-white shadow-md transition-[max-width] duration-200",
            device === "desktop" ? "max-w-[640px]" : "max-w-[360px]",
          )}
        >
          <iframe
            title="Xem trước email"
            srcDoc={iframeSrc}
            sandbox="allow-same-origin allow-popups"
            className="block w-full"
            style={{ height: minHeight, border: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
