import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  FileText,
  Hourglass,
  Plus,
  XCircle,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Pagination } from "@/components/customers/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listReports, type ReportListItem } from "@/lib/queries/reports";
import { REPORT_STATUS_LABEL } from "@/lib/validation/reports";
import type { ReportStatus } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";

export const metadata = { title: "Báo cáo | Portal.Clickstar.vn" };

const STATUS_TONE: Record<ReportStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  pending_approval: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile } = await getCurrentUser();
  const canManage = isInternal(profile);
  const params = await searchParams;
  const status = params.status ?? "all";
  const search = params.q ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  let listResult: Awaited<ReturnType<typeof listReports>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  let loadError: string | null = null;

  try {
    listResult = await listReports({ search, status, page });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  const stats = computeStats(listResult.rows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo định kỳ"
        description={
          canManage
            ? "PM viết báo cáo định kỳ cho từng dự án, sếp duyệt, khách đọc trên portal (PRD §10)."
            : "Báo cáo định kỳ Clickstar gửi cho doanh nghiệp bạn."
        }
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Báo cáo" },
        ]}
        actions={
          canManage ? (
            <Link
              href="/reports/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-blue-600 px-4 text-white hover:bg-blue-700",
              )}
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo báo cáo
            </Link>
          ) : null
        }
      />

      {canManage && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Nháp"
            value={stats.draft}
            icon={CircleDashed}
            tone="slate"
          />
          <StatsCard
            label="Chờ duyệt"
            value={stats.pending}
            icon={Hourglass}
            tone="amber"
          />
          <StatsCard
            label="Đã duyệt"
            value={stats.approved}
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatsCard
            label="Đã từ chối"
            value={stats.rejected}
            icon={XCircle}
            tone="rose"
          />
        </div>
      )}

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <ReportsTable rows={listResult.rows} canManage={canManage} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/reports"
          searchParams={{
            q: search || undefined,
            status: status !== "all" ? status : undefined,
          }}
        />
      )}
    </div>
  );
}

function computeStats(rows: ReportListItem[]) {
  const stats = { draft: 0, pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) {
    if (r.status === "draft") stats.draft += 1;
    else if (r.status === "pending_approval") stats.pending += 1;
    else if (r.status === "approved") stats.approved += 1;
    else if (r.status === "rejected") stats.rejected += 1;
  }
  return stats;
}

function ReportsTable({
  rows,
  canManage,
}: {
  rows: ReportListItem[];
  canManage: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          Chưa có báo cáo
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {canManage ? (
            <>
              Bấm <strong>"Tạo báo cáo"</strong> để PM viết bản tổng hợp định
              kỳ cho dự án.
            </>
          ) : (
            "Khi Clickstar gửi báo cáo định kỳ, danh sách sẽ hiện ở đây."
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tiêu đề</TableHead>
            <TableHead>Dự án</TableHead>
            <TableHead>Kỳ</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Cập nhật</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/reports/${row.id}`}
                  className="font-medium text-slate-900 hover:text-blue-700"
                >
                  {row.title}
                </Link>
                {row.created_by_profile && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    bởi {row.created_by_profile.full_name}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {row.project ? (
                  <Link
                    href={`/projects/${row.project.id}`}
                    className="hover:text-blue-700"
                  >
                    {row.project.name}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-slate-600">
                {row.period_start && row.period_end
                  ? `${format(new Date(row.period_start), "dd/MM")} — ${format(new Date(row.period_end), "dd/MM/yyyy")}`
                  : "—"}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                    STATUS_TONE[row.status],
                  )}
                >
                  {REPORT_STATUS_LABEL[row.status] ?? row.status}
                </span>
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {format(new Date(row.updated_at), "dd/MM/yyyy")}
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
