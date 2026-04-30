import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  Building2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CompanyStatusBadge } from "@/components/dashboard/status-badge";
import { CustomerFilters } from "@/components/customers/customer-filters";
import { CustomerRowMenu } from "@/components/customers/customer-row-menu";
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
  getCustomerStats,
  listCustomers,
  type CustomerListItem,
} from "@/lib/queries/customers";
import type { CompanyStatus } from "@/lib/database.types";

export const metadata = { title: "Khách hàng | Portal.Clickstar.vn" };

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = (params.status as CompanyStatus | "all" | undefined) ?? "all";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const search = params.q ?? "";

  let stats = { total: 0, active: 0, paused: 0, ended: 0 };
  let listResult: Awaited<ReturnType<typeof listCustomers>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  let loadError: string | null = null;

  try {
    [stats, listResult] = await Promise.all([
      getCustomerStats(),
      listCustomers({ search, status, page }),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khách hàng"
        description="Danh sách doanh nghiệp đang hợp tác với Clickstar."
        breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Khách hàng" }]}
        actions={
          <Link
            href="/customers/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-blue-600 px-4 text-white hover:bg-blue-700",
            )}
          >
            <Plus className="mr-2 h-4 w-4" /> Thêm khách hàng
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Tổng khách hàng" value={stats.total} icon={Building2} tone="blue" />
        <StatsCard label="Đang triển khai" value={stats.active} icon={TrendingUp} tone="emerald" />
        <StatsCard label="Tạm dừng" value={stats.paused} icon={RefreshCcw} tone="amber" />
        <StatsCard label="Đã kết thúc" value={stats.ended} icon={ShieldCheck} tone="slate" />
      </div>

      <CustomerFilters />

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <CustomerTable rows={listResult.rows} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/customers"
          searchParams={{ q: search || undefined, status: status !== "all" ? status : undefined }}
        />
      )}
    </div>
  );
}

function CustomerTable({ rows }: { rows: CustomerListItem[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Building2 className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">Chưa có khách hàng</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Bấm <strong>Thêm khách hàng</strong> ở góc trên để tạo bản ghi đầu tiên.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Mã</TableHead>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Ngành nghề</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Người phụ trách</TableHead>
            <TableHead>Tạo lúc</TableHead>
            <TableHead className="w-12 text-right">{""}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs text-slate-500">
                {row.code ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <Link
                    href={`/customers/${row.id}`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    {row.name}
                  </Link>
                  {row.email && (
                    <span className="text-xs text-slate-500">{row.email}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {row.industry ?? "—"}
              </TableCell>
              <TableCell>
                <CompanyStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {row.primary_account_manager?.full_name ?? (
                  <span className="text-slate-400">Chưa phân công</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {format(new Date(row.created_at), "dd/MM/yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <CustomerRowMenu id={row.id} name={row.name} />
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
          <p className="mt-2 text-xs text-red-700/80">
            Nếu chưa chạy migrations, tham khảo <code>docs/SETUP.md</code> để áp schema vào Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
