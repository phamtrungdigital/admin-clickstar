import Link from "next/link";
import { format } from "date-fns";
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileSignature,
  Hourglass,
  Inbox,
  MessageSquare,
  TicketIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/tickets/ticket-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getInternalDashboardStats,
  type InternalDashboardStats,
} from "@/lib/queries/dashboard";
import {
  getCustomerTicketStats,
  listTickets,
  type CustomerTicketStats,
  type TicketListItem,
} from "@/lib/queries/tickets";

export const metadata: Metadata = {
  title: "Tổng quan | Portal.Clickstar.vn",
};

export default async function DashboardPage() {
  const { id: userId, profile } = await getCurrentUser();
  const isInternal = profile?.audience !== "customer";
  const greeting = pickGreeting(profile?.full_name);

  if (!isInternal) {
    const [stats, ticketList] = await Promise.all([
      getCustomerTicketStats(userId).catch(() => null),
      listTickets({ reporter_id: userId, status: "all", pageSize: 5 }).catch(
        () => null,
      ),
    ]);
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Xin chào, ${greeting} 👋`}
          description="Đây là tổng quan các yêu cầu và dịch vụ của bạn."
          breadcrumb={[{ label: "Trang chủ" }, { label: "Tổng quan" }]}
        />
        <CustomerSummary stats={stats} />
        <CustomerRecentTickets rows={ticketList?.rows ?? []} />
      </div>
    );
  }

  const stats = await getInternalDashboardStats().catch(() => null);
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Xin chào, ${greeting} 👋`}
        description="Tổng quan vận hành dịch vụ và chăm sóc khách hàng của Clickstar."
        breadcrumb={[{ label: "Trang chủ" }, { label: "Tổng quan" }]}
      />
      <InternalSummary stats={stats} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlaceholderPanel
          title="Hợp đồng cần xử lý"
          description="Hợp đồng đến hạn, sắp ký, đang chờ duyệt sẽ hiển thị tại đây."
        />
        <PlaceholderPanel
          title="Ticket gần đây"
          description="Yêu cầu hỗ trợ mới và chưa xử lý sẽ hiển thị tại đây."
        />
      </div>
    </div>
  );
}

function InternalSummary({ stats }: { stats: InternalDashboardStats | null }) {
  const fmt = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("vi-VN");
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard
        label="Khách hàng đang hoạt động"
        value={fmt(stats?.activeCustomers)}
        icon={Building2}
        tone="blue"
      />
      <StatsCard
        label="Hợp đồng đang chạy"
        value={fmt(stats?.activeContracts)}
        icon={FileSignature}
        tone="violet"
      />
      <StatsCard
        label="Ticket đang mở"
        value={fmt(stats?.openTickets)}
        icon={MessageSquare}
        tone="amber"
      />
      <StatsCard
        label="Công việc trễ hạn"
        value={fmt(stats?.overdueTasks)}
        icon={CircleAlert}
        tone="rose"
      />
    </div>
  );
}

function CustomerSummary({ stats }: { stats: CustomerTicketStats | null }) {
  const fmt = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("vi-VN");
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <StatsCard
        label="Tổng ticket"
        value={fmt(stats?.total)}
        icon={Inbox}
        tone="blue"
      />
      <StatsCard
        label="Đang xử lý"
        value={fmt(stats?.in_progress)}
        icon={Hourglass}
        tone="violet"
      />
      <StatsCard
        label="Chờ phản hồi"
        value={fmt(stats?.awaiting_customer)}
        icon={MessageSquare}
        tone="amber"
      />
      <StatsCard
        label="Đã hoàn thành"
        value={fmt(stats?.resolved)}
        icon={CheckCircle2}
        tone="emerald"
      />
      <StatsCard
        label="Ticket quá hạn"
        value={fmt(stats?.overdue)}
        icon={AlertOctagon}
        tone="rose"
      />
    </div>
  );
}

function CustomerRecentTickets({ rows }: { rows: TicketListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Ticket của tôi
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            5 yêu cầu gần nhất bạn đã gửi.
          </p>
        </div>
        <Link
          href="/tickets"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Xem tất cả →
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <TicketIcon className="mx-auto h-10 w-10 text-slate-300" />
          <h4 className="mt-3 text-sm font-semibold text-slate-900">
            Chưa có ticket nào
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Tạo ticket mới ở thanh bên trái để gửi yêu cầu hỗ trợ tới Clickstar.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã ticket</TableHead>
              <TableHead>Tiêu đề</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Mức độ</TableHead>
              <TableHead>Cập nhật cuối</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs text-slate-500">
                  {row.code ?? `#${row.id.slice(0, 6)}`}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/tickets/${row.id}`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <TicketStatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <TicketPriorityBadge priority={row.priority} />
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {format(new Date(row.updated_at ?? row.created_at), "dd/MM/yyyy")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// Strip parenthesised tags ("Trung Pham (Khách hàng)" → "Trung Pham") and
// take the LAST remaining word as Vietnamese given name. Fall back to "bạn".
function pickGreeting(fullName: string | null | undefined): string {
  if (!fullName) return "bạn";
  const cleaned = fullName.replace(/\([^)]*\)/g, " ").trim();
  if (!cleaned) return "bạn";
  const parts = cleaned.split(/\s+/);
  return parts[parts.length - 1] || "bạn";
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-400">
        Chưa có dữ liệu — sẽ hiển thị khi Phase C hoàn tất.
      </div>
    </div>
  );
}
