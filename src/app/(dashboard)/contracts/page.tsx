import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  FileSignature,
  Plus,
  Wallet,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ContractFilters } from "@/components/contracts/contract-filters";
import { ContractRowMenu } from "@/components/contracts/contract-row-menu";
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
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
  getContractStats,
  listContracts,
  type ContractListItem,
} from "@/lib/queries/contracts";
import type { ContractStatus } from "@/lib/database.types";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Hợp đồng | Portal.Clickstar.vn" };

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireInternalPage();
  const params = await searchParams;
  const status = (params.status as ContractStatus | "all" | undefined) ?? "all";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const search = params.q ?? "";

  let stats = { total: 0, active: 0, draft: 0, completed: 0, total_value: 0 };
  let listResult: Awaited<ReturnType<typeof listContracts>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  let loadError: string | null = null;

  try {
    [stats, listResult] = await Promise.all([
      getContractStats(),
      listContracts({ search, status, page }),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hợp đồng"
        description="Tất cả hợp đồng dịch vụ với khách hàng."
        breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Hợp đồng" }]}
        actions={
          <Link
            href="/contracts/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-blue-600 px-4 text-white hover:bg-blue-700",
            )}
          >
            <Plus className="mr-2 h-4 w-4" /> Thêm hợp đồng
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Tổng hợp đồng"
          value={stats.total}
          icon={FileSignature}
          tone="blue"
        />
        <StatsCard
          label="Đang triển khai"
          value={stats.active}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatsCard
          label="Nháp"
          value={stats.draft}
          icon={CircleDashed}
          tone="slate"
        />
        <StatsCard
          label="Tổng giá trị"
          value={`${(stats.total_value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`}
          icon={Wallet}
          tone="violet"
        />
      </div>

      <ContractFilters />

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <ContractTable rows={listResult.rows} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/contracts"
          searchParams={{
            q: search || undefined,
            status: status !== "all" ? status : undefined,
          }}
        />
      )}
    </div>
  );
}

function ContractTable({ rows }: { rows: ContractListItem[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <FileSignature className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">Chưa có hợp đồng</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Bấm <strong>Thêm hợp đồng</strong> ở góc trên để tạo hợp đồng đầu tiên.
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
            <TableHead>Hợp đồng</TableHead>
            <TableHead>Khách hàng</TableHead>
            <TableHead className="text-right">Giá trị (VND)</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Bắt đầu</TableHead>
            <TableHead>Kết thúc</TableHead>
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
                    href={`/contracts/${row.id}`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    {row.name}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {row.service_count} dịch vụ
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {row.company ? (
                  <Link
                    href={`/customers/${row.company.id}`}
                    className="hover:text-blue-700"
                  >
                    {row.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right font-medium text-slate-700">
                {Number(row.total_value).toLocaleString("vi-VN")}
              </TableCell>
              <TableCell>
                <ContractStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {row.starts_at ? format(new Date(row.starts_at), "dd/MM/yyyy") : "—"}
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {row.ends_at ? format(new Date(row.ends_at), "dd/MM/yyyy") : "—"}
              </TableCell>
              <TableCell className="text-right">
                <ContractRowMenu id={row.id} name={row.name} />
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
