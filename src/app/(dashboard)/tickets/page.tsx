import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Ticket as TicketIcon,
  TrendingUp,
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
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { TicketRowMenu } from "@/components/tickets/ticket-row-menu";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/tickets/ticket-badges";
import {
  getTicketStats,
  listTickets,
  type TicketListItem,
} from "@/lib/queries/tickets";
import type { TicketPriority, TicketStatus } from "@/lib/database.types";

export const metadata = { title: "Ticket | Portal.Clickstar.vn" };

type SearchParams = {
  q?: string;
  status?: string;
  priority?: string;
  page?: string;
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status =
    (params.status as TicketStatus | "all" | "open" | undefined) ?? "open";
  const priority =
    (params.priority as TicketPriority | "all" | undefined) ?? "all";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const search = params.q ?? "";

  let stats = { total: 0, open: 0, in_progress: 0, resolved: 0 };
  let listResult: Awaited<ReturnType<typeof listTickets>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  let loadError: string | null = null;

  try {
    [stats, listResult] = await Promise.all([
      getTicketStats(),
      listTickets({ search, status, priority, page }),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ticket"
        description="Yêu cầu hỗ trợ và quy trình xử lý CSKH cho khách hàng đã ký hợp đồng."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Ticket" },
        ]}
        actions={
          <Link
            href="/tickets/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-blue-600 px-4 text-white hover:bg-blue-700",
            )}
          >
            <Plus className="mr-2 h-4 w-4" /> Thêm ticket
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Tổng ticket"
          value={stats.total}
          icon={TicketIcon}
          tone="blue"
        />
        <StatsCard
          label="Đang mở"
          value={stats.open}
          icon={Clock}
          tone="amber"
        />
        <StatsCard
          label="Đang xử lý"
          value={stats.in_progress}
          icon={TrendingUp}
          tone="violet"
        />
        <StatsCard
          label="Đã giải quyết"
          value={stats.resolved}
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <TicketFilters />

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <TicketTable rows={listResult.rows} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/tickets"
          searchParams={{
            q: search || undefined,
            status: status !== "open" ? status : undefined,
            priority: priority !== "all" ? priority : undefined,
          }}
        />
      )}
    </div>
  );
}

function TicketTable({ rows }: { rows: TicketListItem[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <TicketIcon className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          Chưa có ticket
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Bấm <strong>Thêm ticket</strong> ở góc trên để tạo ticket hỗ trợ mới.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket</TableHead>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Mức ưu tiên</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Phụ trách</TableHead>
            <TableHead>Tạo lúc</TableHead>
            <TableHead className="w-12 text-right">{""}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <Link
                    href={`/tickets/${row.id}`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    {row.title}
                  </Link>
                  {row.code && (
                    <span className="font-mono text-xs text-slate-500">
                      {row.code}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {row.company ? (
                  <Link
                    href={`/customers/${row.company.id}`}
                    className="hover:text-blue-700"
                  >
                    {row.company.name}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell>
                <TicketPriorityBadge priority={row.priority} />
              </TableCell>
              <TableCell>
                <TicketStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {row.assignee?.full_name ?? (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {format(new Date(row.created_at), "dd/MM/yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <TicketRowMenu
                  id={row.id}
                  title={row.title}
                  currentStatus={row.status}
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
