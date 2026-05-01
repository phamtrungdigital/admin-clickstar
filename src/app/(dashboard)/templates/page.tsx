import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ListTree,
  PauseCircle,
  Plus,
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
import {
  listTemplates,
  type TemplateListItem,
} from "@/lib/queries/templates";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Template dịch vụ | Portal.Clickstar.vn" };

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireInternalPage();
  const canManage =
    profile.internal_role === "super_admin" || profile.internal_role === "admin";

  const params = await searchParams;
  const status = params.status ?? "all";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const search = params.q ?? "";

  let listResult: Awaited<ReturnType<typeof listTemplates>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  let loadError: string | null = null;

  try {
    listResult = await listTemplates({
      search,
      page,
      is_active:
        status === "active" ? true : status === "paused" ? false : "all",
    });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  const stats = computeStats(listResult.rows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template dịch vụ"
        description="Khuôn mẫu task list tái sử dụng — fork độc lập khi áp vào hợp đồng (PRD §5)."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Template dịch vụ" },
        ]}
        actions={
          canManage ? (
            <Link
              href="/templates/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-blue-600 px-4 text-white hover:bg-blue-700",
              )}
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo template
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          label="Tổng template"
          value={stats.total}
          icon={ListTree}
          tone="blue"
        />
        <StatsCard
          label="Đang dùng"
          value={stats.active}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatsCard
          label="Tạm ngưng"
          value={stats.paused}
          icon={PauseCircle}
          tone="amber"
        />
      </div>

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <TemplatesTable rows={listResult.rows} canManage={canManage} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/templates"
          searchParams={{
            q: search || undefined,
            status: status !== "all" ? status : undefined,
          }}
        />
      )}
    </div>
  );
}

function computeStats(rows: TemplateListItem[]) {
  const stats = { total: rows.length, active: 0, paused: 0 };
  for (const r of rows) {
    if (r.is_active) stats.active += 1;
    else stats.paused += 1;
  }
  return stats;
}

function TemplatesTable({
  rows,
  canManage,
}: {
  rows: TemplateListItem[];
  canManage: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <ListTree className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          Chưa có template nào
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {canManage ? (
            <>
              Tạo template đầu tiên để chuẩn hoá quy trình một loại dịch vụ.
              Khi tạo hợp đồng, anh chọn template phù hợp → hệ thống auto-sinh
              task list theo offset đã định.
            </>
          ) : (
            "Quản trị viên chưa tạo template nào."
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
            <TableHead>Template</TableHead>
            <TableHead>Ngành</TableHead>
            <TableHead className="text-right">Thời lượng</TableHead>
            <TableHead className="text-right">Milestones</TableHead>
            <TableHead className="text-right">Tasks</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Cập nhật</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <Link
                    href={`/templates/${row.id}`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    {row.name}
                  </Link>
                  <span className="text-xs text-slate-500">v{row.version}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {row.industry ?? <span className="text-slate-400">—</span>}
              </TableCell>
              <TableCell className="text-right text-sm text-slate-700">
                {row.duration_days ? `${row.duration_days} ngày` : "—"}
              </TableCell>
              <TableCell className="text-right text-sm text-slate-700">
                {row.milestone_count}
              </TableCell>
              <TableCell className="text-right text-sm text-slate-700">
                {row.task_count}
              </TableCell>
              <TableCell>
                {row.is_active ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Đang dùng
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    Tạm ngưng
                  </span>
                )}
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
