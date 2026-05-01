import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, FileText } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import { getDocumentById } from "@/lib/queries/documents";
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_VISIBILITY_LABEL,
} from "@/lib/validation/documents";
import type { DocumentVisibility } from "@/lib/database.types";
import { DocumentRowActions } from "@/components/documents/document-row-actions";

const VISIBILITY_TONE: Record<DocumentVisibility, string> = {
  internal: "bg-slate-100 text-slate-700 ring-slate-200",
  shared: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  public: "bg-blue-50 text-blue-700 ring-blue-200",
};

export const metadata = { title: "Tài liệu | Portal.Clickstar.vn" };

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await getCurrentUser();
  const canManage = isInternal(profile);

  const doc = await getDocumentById(id);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={doc.name}
        description={doc.description ?? undefined}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Tài liệu", href: "/documents" },
          { label: doc.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/documents"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Danh sách
            </Link>
            <DocumentRowActions
              documentId={doc.id}
              visibility={doc.visibility}
              canManage={canManage}
            />
          </div>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <FileText className="h-6 w-6 text-slate-500" />
          </span>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-base font-medium text-slate-900">{doc.name}</p>
              <p className="text-xs text-slate-500">
                {doc.mime_type ?? "Không rõ MIME"} ·{" "}
                {doc.size_bytes ? formatBytes(doc.size_bytes) : "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill label={`Loại: ${DOCUMENT_KIND_LABEL[doc.kind]}`} />
              <Pill
                label={DOCUMENT_VISIBILITY_LABEL[doc.visibility]}
                tone={VISIBILITY_TONE[doc.visibility]}
              />
              {doc.company && (
                <Pill label={`Khách: ${doc.company.name}`} />
              )}
              {doc.project && (
                <Pill label={`Dự án: ${doc.project.name}`} />
              )}
              {doc.contract?.code && (
                <Pill label={`HĐ: ${doc.contract.code}`} />
              )}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-3 border-t border-slate-200 pt-6 text-sm sm:grid-cols-2">
          <Field
            label="Người upload"
            value={doc.uploader?.full_name ?? "—"}
          />
          <Field
            label="Tạo lúc"
            value={format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}
          />
          <Field
            label="Cập nhật"
            value={format(new Date(doc.updated_at), "dd/MM/yyyy HH:mm")}
          />
          <Field label="Mã tài liệu" value={doc.id} mono />
        </dl>
      </div>
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone ?? "bg-slate-50 text-slate-700 ring-slate-200",
      )}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-slate-900",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
