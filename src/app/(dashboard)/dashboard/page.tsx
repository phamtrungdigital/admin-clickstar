import Link from "next/link";
import { format } from "date-fns";
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileSignature,
  Flame,
  Hourglass,
  Inbox,
  ListChecks,
  MessageSquare,
  Sparkles,
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
import { getTaskStats, listTasks, type TaskListItem } from "@/lib/queries/tasks";
import { listProjects } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tổng quan | Portal.Clickstar.vn",
};

export default async function DashboardPage() {
  const { id: userId, profile } = await getCurrentUser();
  const audience = profile?.audience ?? "customer";
  const internalRole = profile?.internal_role;
  const greeting = pickGreeting(profile?.full_name);

  if (audience === "customer") {
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

  // Internal — split between Admin (super_admin/admin) and Staff (rest).
  const isAdmin = internalRole === "super_admin" || internalRole === "admin";
  if (isAdmin) {
    const [globalStats, projectsResult, taskStats] = await Promise.all([
      getInternalDashboardStats().catch(() => null),
      listProjects({ pageSize: 6 }).catch(() => ({ rows: [], total: 0, page: 1, pageSize: 6 })),
      getTaskStats().catch(() => null),
    ]);
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Xin chào, ${greeting} 👋`}
          description="Tổng quan vận hành toàn hệ thống Clickstar."
          breadcrumb={[{ label: "Trang chủ" }, { label: "Tổng quan" }]}
        />
        <AdminSummary stats={globalStats} taskStats={taskStats} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ProjectsPanel
            title="Dự án đang chạy"
            description="Các dự án mới nhất, theo template đã fork."
            projects={projectsResult.rows}
          />
          <PlaceholderPanel
            title="Snapshot chờ duyệt"
            description="Sẽ hiển thị khi Phase 2 (snapshot mechanism) hoàn tất."
          />
        </div>
      </div>
    );
  }

  // Staff (manager / staff / support / accountant) — "Việc của tôi" view:
  // task được giao + ticket assignee. Support/staff thường có cả 2.
  const [myTaskStats, myTasksResult, myTicketsResult] = await Promise.all([
    getTaskStats({ assignee_id: userId }).catch(() => null),
    listTasks({ assignee_id: userId, pageSize: 6 }).catch(() => ({
      rows: [] as TaskListItem[],
      total: 0,
      page: 1,
      pageSize: 6,
    })),
    listTickets({ assignee_id: userId, status: "open", pageSize: 5 }).catch(
      () => ({
        rows: [] as TicketListItem[],
        total: 0,
        page: 1,
        pageSize: 5,
      }),
    ),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Xin chào, ${greeting} 👋`}
        description="Công việc và ticket anh/chị đang phụ trách."
        breadcrumb={[{ label: "Trang chủ" }, { label: "Tổng quan" }]}
      />
      <StaffSummary stats={myTaskStats} />
      <div className="grid gap-6 lg:grid-cols-2">
        <StaffRecentTasks rows={myTasksResult.rows} />
        <StaffRecentTickets rows={myTicketsResult.rows} />
      </div>
    </div>
  );
}

function AdminSummary({
  stats,
  taskStats,
}: {
  stats: InternalDashboardStats | null;
  taskStats: { open: number; overdue: number } | null;
}) {
  const fmt = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("vi-VN");
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        label="Task đang mở"
        value={fmt(taskStats?.open)}
        icon={ListChecks}
        tone="emerald"
      />
      <StatsCard
        label="Task quá hạn"
        value={fmt(taskStats?.overdue ?? stats?.overdueTasks)}
        icon={CircleAlert}
        tone="rose"
      />
    </div>
  );
}

function StaffSummary({
  stats,
}: {
  stats: {
    total: number;
    open: number;
    overdue: number;
    awaiting_review: number;
    blocked: number;
    done: number;
  } | null;
}) {
  const fmt = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("vi-VN");
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatsCard
        label="Task của tôi"
        value={fmt(stats?.open)}
        icon={Inbox}
        tone="blue"
      />
      <StatsCard
        label="Quá hạn"
        value={fmt(stats?.overdue)}
        icon={CircleAlert}
        tone="rose"
      />
      <StatsCard
        label="Đang chờ duyệt"
        value={fmt(stats?.awaiting_review)}
        icon={Flame}
        tone="violet"
      />
      <StatsCard
        label="Bị chặn"
        value={fmt(stats?.blocked)}
        icon={AlertOctagon}
        tone="amber"
      />
      <StatsCard
        label="Đã hoàn thành"
        value={fmt(stats?.done)}
        icon={CheckCircle2}
        tone="emerald"
      />
    </div>
  );
}

function ProjectsPanel({
  title,
  description,
  projects,
}: {
  title: string;
  description: string;
  projects: Awaited<ReturnType<typeof listProjects>>["rows"];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <Link
          href="/projects"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Xem tất cả →
        </Link>
      </div>
      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-400">
          Chưa có dự án nào. Vào{" "}
          <Link href="/contracts" className="text-blue-600 hover:underline">
            Hợp đồng
          </Link>
          {" "}để fork template.
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-slate-100 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/projects/${p.id}`}
                  className="text-sm font-medium text-slate-900 hover:text-blue-700"
                >
                  {p.name}
                </Link>
                <span className="text-xs font-semibold text-slate-700">
                  {p.progress_percent}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${p.progress_percent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {p.contract?.code ?? "—"} · {p.milestone_count} milestones · {p.task_count} tasks
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StaffRecentTasks({ rows }: { rows: TaskListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Task của tôi</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Task được giao cho anh/chị, ưu tiên theo deadline gần nhất.
          </p>
        </div>
        <Link
          href="/tasks?view=mine"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Xem tất cả →
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <ListChecks className="mx-auto h-10 w-10 text-slate-300" />
          <h4 className="mt-3 text-sm font-semibold text-slate-900">
            Chưa có task được giao
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Khi PM giao task cho anh/chị, danh sách sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Dự án</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const overdue =
                !!row.due_at &&
                row.due_at < new Date().toISOString() &&
                row.status !== "done" &&
                row.status !== "cancelled";
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {row.title}
                      </span>
                      {row.is_extra && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                          <Sparkles className="h-2.5 w-2.5" />
                          Phát sinh
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {row.project?.name ?? <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm",
                      overdue ? "font-medium text-rose-600" : "text-slate-600",
                    )}
                  >
                    {row.due_at
                      ? format(new Date(row.due_at), "dd/MM/yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                      {STATUS_LABEL[row.status]}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function StaffRecentTickets({ rows }: { rows: TicketListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Ticket của tôi
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Ticket đang mở mà bạn được phân công xử lý.
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
          <MessageSquare className="mx-auto h-10 w-10 text-slate-300" />
          <h4 className="mt-3 text-sm font-semibold text-slate-900">
            Chưa có ticket được giao
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Khi admin/manager assign ticket cho bạn, danh sách sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Khách</TableHead>
              <TableHead>Ưu tiên</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    href={`/tickets/${row.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-blue-700"
                  >
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-slate-700">
                  {row.company?.name ?? <span className="text-slate-400">—</span>}
                </TableCell>
                <TableCell className="text-sm text-slate-600 capitalize">
                  {row.priority}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                    {row.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  todo: "Mới tạo",
  assigned: "Đã giao",
  in_progress: "Đang làm",
  blocked: "Bị chặn",
  awaiting_review: "Chờ duyệt",
  awaiting_customer: "Chờ khách",
  returned: "Trả về",
  done: "Hoàn thành",
  cancelled: "Đã huỷ",
};

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
