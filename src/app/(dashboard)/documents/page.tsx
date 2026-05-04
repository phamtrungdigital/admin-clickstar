import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle, FileText, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/customers/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listDocuments,
  type DocumentListItem,
  type DocumentScope,
} from "@/lib/queries/documents";
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_VISIBILITY_LABEL,
} from "@/lib/validation/documents";
import type {
  DocumentKind,
  DocumentVisibility,
} from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import { DocumentsFilters } from "@/components/documents/documents-filters";
import { DocumentRowActions } from "@/components/documents/document-row-actions";

export const metadata = { title: "Tài liệu | Portal.Clickstar.vn" };

const VISIBILITY_TONE: Record<DocumentVisibility, string> = {
  internal: "bg-slate-100 text-slate-700 ring-slate-200",
  shared: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  public: "bg-blue-50 text-blue-700 ring-blue-200",
};

type SearchParams = {
  q?: string;
  kind?: string;
  visibility?: string;
  scope?: string;
  page?: string;
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile } = await getCurrentUser();
  const canManage = isInternal(profile);
  const params = await searchParams;
  const search = params.q ?? "";
  const kind = (params.kind ?? "all") as DocumentKind | "all";
  const visibility = (params.visibility ?? "all") as DocumentVisibility | "all";
  const scope = (params.scope ?? "all") as DocumentScope;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  let listResult: Awaited<ReturnType<typeof listDocuments>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  let loadError: string | null = null;

  try {
    listResult = await listDocuments({ search, kind, visibility, scope, page });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tài liệu"
        description={
          canManage
            ? "Hợp đồng, biên bản, brief, file thiết kế, ... lưu trên Supabase Storage. Bật Chia sẻ để khách xem được trên portal (PRD §11)."
            : "Tài liệu Clickstar đã chia sẻ với doanh nghiệp bạn."
        }
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Tài liệu" },
        ]}
        actions={
          canManage ? (
            <Link
              href="/documents/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-blue-600 px-4 text-white hover:bg-blue-700",
              )}
            >
              <Plus className="mr-2 h-4 w-4" /> Upload tài liệu
            </Link>
          ) : null
        }
      />

      <DocumentsFilters
        key={search}
        search={search}
        kind={kind}
        visibility={visibility}
        scope={scope}
        canManage={canManage}
      />

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <DocumentsTable rows={listResult.rows} canManage={canManage} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/documents"
          searchParams={{
            q: search || undefined,
            kind: kind !== "all" ? kind : undefined,
            visibility: visibility !== "all" ? visibility : undefined,
            scope: scope !== "all" ? scope : undefined,
          }}
        />
      )}
    </div>
  );
}

function DocumentsTable({
  rows,
  canManage,
}: {
  rows: DocumentListItem[];
  canManage: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Chưa có tài liệu"
        description={
          canManage
            ? "Bấm \"Upload tài liệu\" để gắn hợp đồng, brief, file thiết kế cho khách."
            : "Khi Clickstar chia sẻ tài liệu, danh sách sẽ hiện ở đây."
        }
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên tài liệu</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Quyền</TableHead>
            <TableHead>Kích thước</TableHead>
            <TableHead>Tạo lúc</TableHead>
            <TableHead className="w-12 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/documents/${row.id}`}
                  className="font-medium text-slate-900 hover:text-blue-700"
                >
                  {row.name}
                </Link>
                {row.uploader && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    bởi {row.uploader.full_name}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {DOCUMENT_KIND_LABEL[row.kind]}
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {row.company?.name ?? (
                  <span className="text-xs italic text-slate-500">
                    — Nội bộ Clickstar —
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                    VISIBILITY_TONE[row.visibility],
                  )}
                >
                  {DOCUMENT_VISIBILITY_LABEL[row.visibility]}
                </span>
              </TableCell>
              <TableCell className="text-xs text-slate-600">
                {row.size_bytes ? formatBytes(row.size_bytes) : "—"}
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {format(new Date(row.created_at), "dd/MM/yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <DocumentRowActions
                  documentId={row.id}
                  visibility={row.visibility}
                  canManage={canManage}
                  companyName={row.company?.name ?? null}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
        <div>
          <h3 className="text-sm font-semibold text-red-900">
            Không tải được danh sách
          </h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
        </div>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
