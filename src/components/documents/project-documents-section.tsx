import Link from "next/link";
import { format } from "date-fns";
import { FileText, Plus } from "lucide-react";

import { listDocumentsForProject } from "@/lib/queries/documents";
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_VISIBILITY_LABEL,
} from "@/lib/validation/documents";
import { cn } from "@/lib/utils";
import type { DocumentVisibility } from "@/lib/database.types";
import { DocumentRowActions } from "@/components/documents/document-row-actions";

const VISIBILITY_TONE: Record<DocumentVisibility, string> = {
  internal: "bg-slate-100 text-slate-700 ring-slate-200",
  shared: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  public: "bg-blue-50 text-blue-700 ring-blue-200",
};

export async function ProjectDocumentsSection({
  projectId,
  companyId,
  canManage,
}: {
  projectId: string;
  companyId?: string;
  canManage: boolean;
}) {
  const docs = await listDocumentsForProject(projectId).catch(() => []);

  // For customer view (canManage=false), RLS already filters to visibility
  // shared/public — but double-check defensively in case a future change
  // alters the policy. For internal staff, show everything in the project.
  const visible = canManage
    ? docs
    : docs.filter((d) => d.visibility === "shared" || d.visibility === "public");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Tài liệu ({visible.length})
        </h2>
        {canManage && (
          <Link
            href={
              companyId
                ? `/documents/new?company=${companyId}&project=${projectId}`
                : `/documents/new?project=${projectId}`
            }
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            <Plus className="h-3.5 w-3.5" /> Upload
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            {canManage
              ? "Chưa có tài liệu cho dự án này."
              : "Chưa có tài liệu được chia sẻ."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                <FileText className="h-4 w-4 text-slate-500" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/documents/${d.id}`}
                  className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700"
                >
                  {d.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {DOCUMENT_KIND_LABEL[d.kind]} ·{" "}
                  {format(new Date(d.created_at), "dd/MM/yyyy")}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                  VISIBILITY_TONE[d.visibility],
                )}
              >
                {DOCUMENT_VISIBILITY_LABEL[d.visibility]}
              </span>
              <DocumentRowActions
                documentId={d.id}
                visibility={d.visibility}
                canManage={canManage}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
