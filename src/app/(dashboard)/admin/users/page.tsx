import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ListChecks,
  Plus,
  Ticket,
  Users as UsersIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { RoleBadge } from "@/components/admin/role-badge";
import { UserFilters } from "@/components/admin/user-filters";
import { UserRowMenu } from "@/components/admin/user-row-menu";
import {
  getUserStats,
  listUsers,
  type UserListItem,
} from "@/lib/queries/users";
import type { Audience, InternalRole } from "@/lib/database.types";

export const metadata = { title: "Người dùng | Portal.Clickstar.vn" };

type SearchParams = {
  q?: string;
  audience?: string;
  role?: string;
  active?: string;
  page?: string;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const audience = (params.audience as Audience | "all" | undefined) ?? "all";
  const role = (params.role as InternalRole | "all" | undefined) ?? "all";
  const active =
    (params.active as "all" | "active" | "inactive" | undefined) ?? "active";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const search = params.q ?? "";

  let stats = { total: 0, active: 0, internal: 0, customer: 0 };
  let listResult: Awaited<ReturnType<typeof listUsers>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  let loadError: string | null = null;

  try {
    [stats, listResult] = await Promise.all([
      getUserStats(),
      listUsers({ search, audience, role, active, page }),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Người dùng"
        description="Quản lý tài khoản nội bộ Clickstar và khách hàng — vai trò, phân công và workload."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Người dùng" },
        ]}
        actions={
          <Link
            href="/admin/users/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-blue-600 px-4 text-white hover:bg-blue-700",
            )}
          >
            <Plus className="mr-2 h-4 w-4" /> Thêm tài khoản
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Tổng tài khoản"
          value={stats.total}
          icon={UsersIcon}
          tone="blue"
        />
        <StatsCard
          label="Đang hoạt động"
          value={stats.active}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatsCard
          label="Nội bộ Clickstar"
          value={stats.internal}
          icon={Building2}
          tone="violet"
        />
        <StatsCard
          label="Khách hàng"
          value={stats.customer}
          icon={Building2}
          tone="amber"
        />
      </div>

      <UserFilters />

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <UserTable rows={listResult.rows} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/admin/users"
          searchParams={{
            q: search || undefined,
            audience: audience !== "all" ? audience : undefined,
            role: role !== "all" ? role : undefined,
            active: active !== "active" ? active : undefined,
          }}
        />
      )}
    </div>
  );
}

function UserTable({ rows }: { rows: UserListItem[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Chưa có tài khoản"
        description={
          <>
            Bấm <strong>Thêm tài khoản</strong> ở góc trên để tạo người dùng.
          </>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Họ tên</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead className="text-right">KH chăm</TableHead>
            <TableHead className="text-right">Task open</TableHead>
            <TableHead className="text-right">Ticket open</TableHead>
            <TableHead>Hoạt động</TableHead>
            <TableHead className="w-12 text-right">{""}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={cn(!row.is_active && "opacity-60")}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar name={row.full_name} url={row.avatar_url} />
                  <div className="flex flex-col">
                    <Link
                      href={`/admin/users/${row.id}`}
                      className="font-medium text-slate-900 hover:text-blue-700"
                    >
                      {row.full_name || "(chưa đặt tên)"}
                    </Link>
                    <span className="text-xs text-slate-500">
                      Tạo {format(new Date(row.created_at), "dd/MM/yyyy")}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {row.email ?? <span className="text-slate-400">—</span>}
              </TableCell>
              <TableCell>
                <RoleBadge role={row.internal_role} audience={row.audience} />
              </TableCell>
              <TableCell className="text-right text-sm text-slate-700">
                {row.customers_count > 0 ? (
                  <span className="font-medium">{row.customers_count}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-right text-sm text-slate-700">
                {row.open_tasks > 0 ? (
                  <ChipNumber value={row.open_tasks} icon={ListChecks} />
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-right text-sm text-slate-700">
                {row.open_tickets > 0 ? (
                  <ChipNumber value={row.open_tickets} icon={Ticket} />
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell>
                {row.is_active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Hoạt động
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Vô hiệu hoá
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <UserRowMenu
                  id={row.id}
                  name={row.full_name || "tài khoản này"}
                  isActive={row.is_active}
                  customersCount={row.customers_count}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ChipNumber({
  value,
  icon: Icon,
}: {
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
      <Icon className="h-3 w-3" />
      {value}
    </span>
  );
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(-2)
    .join("")
    .toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ""}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
      {initials || "?"}
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
