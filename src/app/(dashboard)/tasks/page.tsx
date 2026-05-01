import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  ListChecks,
  Search,
  Sparkles,
} from "lucide-react";

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
  getTaskStats,
  listTasks,
  type TaskListItem,
} from "@/lib/queries/tasks";
import type { TaskPriority, TaskStatus } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

export const metadata = { title: "Công việc | Portal.Clickstar.vn" };

type SearchParams = {
  view?: string;
  q?: string;
  page?: string;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
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

const STATUS_TONE: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700 ring-slate-200",
  assigned: "bg-sky-50 text-sky-700 ring-sky-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  blocked: "bg-rose-50 text-rose-700 ring-rose-200",
  awaiting_review: "bg-violet-50 text-violet-700 ring-violet-200",
  awaiting_customer: "bg-amber-50 text-amber-700 ring-amber-200",
  returned: "bg-orange-50 text-orange-700 ring-orange-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "text-slate-500",
  medium: "text-blue-600",
  high: "text-amber-600",
  urgent: "text-rose-600",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
};

const VIEWS = [
  { id: "all", label: "Tất cả", icon: ListChecks },
  { id: "mine", label: "Của tôi", icon: Inbox },
  { id: "overdue", label: "Quá hạn", icon: Clock },
  { id: "review", label: "Chờ duyệt", icon: Flame },
  { id: "blocked", label: "Bị chặn", icon: AlertOctagon },
  { id: "extra", label: "Phát sinh", icon: Sparkles },
] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { id: userId, profile } = await getCurrentUser();
  const canViewAll = isInternal(profile);
  const params = await searchParams;
  const view = (params.view as (typeof VIEWS)[number]["id"]) ?? "all";
  const search = params.q ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const queryParams: Parameters<typeof listTasks>[0] = {
    search,
    page,
    pageSize: 30,
  };
  if (view === "mine") queryParams.assignee_id = userId;
  if (view === "overdue") queryParams.status = "overdue";
  if (view === "review") queryParams.status = "awaiting_review";
  if (view === "blocked") queryParams.status = "blocked";
  if (view === "extra") queryParams.is_extra = true;

  let listResult: Awaited<ReturnType<typeof listTasks>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 30,
  };
  let stats = {
    total: 0,
    open: 0,
    overdue: 0,
    awaiting_review: 0,
    blocked: 0,
    done: 0,
  };
  let loadError: string | null = null;
  try {
    [listResult, stats] = await Promise.all([
      listTasks(queryParams),
      getTaskStats(canViewAll ? {} : { assignee_id: userId }),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Công việc"
        description={
          canViewAll
            ? "Toàn bộ task trong hệ thống. Filter theo dự án, deadline, người phụ trách."
            : "Task được giao cho anh/chị."
        }
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Công việc" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatsCard
          label="Đang mở"
          value={stats.open}
          icon={ListChecks}
          tone="blue"
        />
        <StatsCard
          label="Quá hạn"
          value={stats.overdue}
          icon={Clock}
          tone="rose"
        />
        <StatsCard
          label="Chờ duyệt"
          value={stats.awaiting_review}
          icon={Flame}
          tone="violet"
        />
        <StatsCard
          label="Bị chặn"
          value={stats.blocked}
          icon={AlertOctagon}
          tone="amber"
        />
        <StatsCard
          label="Hoàn thành"
          value={stats.done}
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <ViewTabs current={view} search={search} />

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Không tải được danh sách
              </h3>
              <p className="mt-1 text-sm text-red-700">{loadError}</p>
            </div>
          </div>
        </div>
      ) : (
        <TasksTable rows={listResult.rows} canViewAll={canViewAll} />
      )}

      {!loadError && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/tasks"
          searchParams={{
            view: view !== "all" ? view : undefined,
            q: search || undefined,
          }}
        />
      )}
    </div>
  );
}

function ViewTabs({
  current,
  search,
}: {
  current: string;
  search: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap items-center gap-1">
        {VIEWS.map((v) => {
          const params = new URLSearchParams();
          if (v.id !== "all") params.set("view", v.id);
          if (search) params.set("q", search);
          const href = `/tasks${params.toString() ? `?${params.toString()}` : ""}`;
          const Icon = v.icon;
          const active = current === v.id;
          return (
            <Link
              key={v.id}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {v.label}
            </Link>
          );
        })}
      </div>
      <div className="ml-auto flex flex-1 items-center sm:flex-none">
        <form className="relative flex-1 sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Tìm task..."
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {current !== "all" && <input type="hidden" name="view" value={current} />}
        </form>
      </div>
    </div>
  );
}

function TasksTable({
  rows,
  canViewAll,
}: {
  rows: TaskListItem[];
  canViewAll: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <ListChecks className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          Không có task nào
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {canViewAll
            ? "Khi PM tạo task hoặc fork template, danh sách sẽ hiện ở đây."
            : "Hiện tại anh/chị chưa được giao task nào."}
        </p>
      </div>
    );
  }
  const nowIso = new Date().toISOString();
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[280px]">Task</TableHead>
            <TableHead>Dự án / Milestone</TableHead>
            <TableHead>Người phụ trách</TableHead>
            <TableHead>Reviewer</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Ưu tiên</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((task) => {
            const overdue =
              !!task.due_at &&
              task.due_at < nowIso &&
              task.status !== "done" &&
              task.status !== "cancelled";
            return (
              <TableRow key={task.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-blue-700"
                    >
                      {task.title}
                    </Link>
                    {task.is_extra && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
                        title={`Phát sinh${task.extra_source ? ` (${task.extra_source})` : ""}`}
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        Phát sinh
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {task.project ? (
                    <Link
                      href={`/projects/${task.project.id}`}
                      className="hover:text-blue-700"
                    >
                      {task.project.name}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {task.milestone && (
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {task.milestone.code && `${task.milestone.code} · `}
                      {task.milestone.title}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-700">
                  {task.assignee?.full_name ?? (
                    <span className="text-slate-400">Chưa gán</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-700">
                  {task.reviewer?.full_name ?? (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-sm",
                    overdue ? "font-medium text-rose-600" : "text-slate-600",
                  )}
                >
                  {task.due_at
                    ? format(new Date(task.due_at), "dd/MM/yyyy")
                    : "—"}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      STATUS_TONE[task.status],
                    )}
                  >
                    {STATUS_LABEL[task.status]}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      PRIORITY_TONE[task.priority],
                    )}
                  >
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
