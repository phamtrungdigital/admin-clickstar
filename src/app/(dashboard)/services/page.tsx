import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Package,
  PauseCircle,
  Plus,
  TrendingUp,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ServiceFilters } from "@/components/services/service-filters";
import { ServiceRowMenu } from "@/components/services/service-row-menu";
import { ServiceStatusBadge } from "@/components/services/service-status-badge";
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
  getServiceStats,
  listDistinctServiceCategories,
  listServices,
  type ServiceListItem,
} from "@/lib/queries/services";

export const metadata = { title: "Dịch vụ | Portal.Clickstar.vn" };

type SearchParams = {
  q?: string;
  status?: string;
  category?: string;
  page?: string;
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = (params.status as "active" | "paused" | "all" | undefined) ?? "all";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const search = params.q ?? "";
  const category = params.category ?? "all";

  let stats = { total: 0, active: 0, paused: 0 };
  let listResult: Awaited<ReturnType<typeof listServices>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  let categories: string[] = [];
  let loadError: string | null = null;

  try {
    [stats, listResult, categories] = await Promise.all([
      getServiceStats(),
      listServices({ search, status, category, page }),
      listDistinctServiceCategories(),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dịch vụ"
        description="Danh mục dịch vụ Clickstar đang cung cấp."
        breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Dịch vụ" }]}
        actions={
          <Link
            href="/services/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-blue-600 px-4 text-white hover:bg-blue-700",
            )}
          >
            <Plus className="mr-2 h-4 w-4" /> Thêm dịch vụ
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Tổng dịch vụ" value={stats.total} icon={Package} tone="blue" />
        <StatsCard label="Đang cung cấp" value={stats.active} icon={TrendingUp} tone="emerald" />
        <StatsCard label="Tạm ngưng" value={stats.paused} icon={PauseCircle} tone="amber" />
        <StatsCard
          label="Danh mục"
          value={categories.length}
          icon={Bell}
          tone="violet"
        />
      </div>

      <ServiceFilters categories={categories} />

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <ServiceTable rows={listResult.rows} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/services"
          searchParams={{
            q: search || undefined,
            status: status !== "all" ? status : undefined,
            category: category !== "all" ? category : undefined,
          }}
        />
      )}
    </div>
  );
}

function ServiceTable({ rows }: { rows: ServiceListItem[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Package className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">Chưa có dịch vụ</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Bấm <strong>Thêm dịch vụ</strong> ở góc trên để khai báo dịch vụ Clickstar
          cung cấp.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dịch vụ</TableHead>
            <TableHead>Danh mục</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Đang sử dụng</TableHead>
            <TableHead className="w-12 text-right">{""}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <Link
                    href={`/services/${row.id}`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    {row.name}
                  </Link>
                  {row.code && (
                    <span className="font-mono text-xs text-slate-500">{row.code}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {row.category ?? <span className="text-slate-400">—</span>}
              </TableCell>
              <TableCell>
                <ServiceStatusBadge isActive={row.is_active} />
              </TableCell>
              <TableCell className="text-right text-sm text-slate-600">
                {row.customers_using > 0 ? (
                  `${row.customers_using} hợp đồng`
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <ServiceRowMenu
                  id={row.id}
                  name={row.name}
                  isActive={row.is_active}
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
          <h3 className="text-sm font-semibold text-red-900">Không tải được danh sách</h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
        </div>
      </div>
    </div>
  );
}
