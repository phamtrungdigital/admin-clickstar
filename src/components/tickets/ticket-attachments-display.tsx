import { FileText, Image as ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TicketAttachment } from "@/lib/database.types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function TicketAttachmentsDisplay({
  attachments,
  urls,
}: {
  attachments: TicketAttachment[];
  urls: Record<string, string>;
}) {
  if (attachments.length === 0) {
    return <p className="text-sm text-slate-400">Không có tệp đính kèm.</p>;
  }

  const images = attachments.filter((a) => a.content_type.startsWith("image/"));
  const others = attachments.filter(
    (a) => !a.content_type.startsWith("image/"),
  );

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((a) => {
            const url = urls[a.path];
            if (!url) return null;
            return (
              <a
                key={a.path}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                title={a.filename}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={a.filename}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-2 py-1 text-[11px] text-white">
                  {a.filename}
                </span>
              </a>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <ul className="space-y-2">
          {others.map((a) => (
            <li key={a.path}>
              <a
                href={urls[a.path]}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 hover:border-blue-300 hover:bg-blue-50/30",
                )}
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                  {a.content_type.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {a.filename}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(a.size)}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
