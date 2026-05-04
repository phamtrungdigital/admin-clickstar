import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarClock,
  ChevronLeft,
  Eye,
  EyeOff,
  Folder,
  Pencil,
  Sparkles,
  User,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { TaskTransitions } from "@/components/tasks/task-transitions";
import { TaskChecklistEditor } from "@/components/tasks/task-checklist";
import { TaskCommentsThread } from "@/components/tasks/task-comments";
import {
  getTaskById,
  listTaskComments,
  type TaskDetail,
} from "@/lib/queries/tasks";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import {
  EXTRA_SOURCE_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
} from "@/lib/validation/tasks";
import type { TaskPriority, TaskStatus } from "@/lib/database.types";

export const metadata = { title: "Chi tiết đầu việc | Portal.Clickstar.vn" };

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

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { id: userId, profile } = await getCurrentUser();
  const internal = isInternal(profile);
  const role = profile?.internal_role;
  const isAdmin = role === "super_admin" || role === "admin";

  const [task, comments] = await Promise.all([
    getTaskById(id).catch(() => null),
    listTaskComments(id).catch(() => []),
  ]);
  if (!task) notFound();

  const isAssignee = internal && task.assignee?.id === userId;
  const isReviewer = internal && task.reviewer?.id === userId;

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Đầu việc", href: "/tasks" },
          ...(task.project
            ? ([
                {
                  label: task.project.name,
                  href: `/projects/${task.project.id}`,
                },
              ] as { label: string; href: string }[])
            : []),
          { label: task.title },
        ]}
        actions={
          <>
            <Link
              href={task.project ? `/projects/${task.project.id}` : "/tasks"}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-4",
              )}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Quay lại
            </Link>
            {internal && (
              <Link
                href={`/tasks/${task.id}/edit`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "px-4",
                )}
              >
                <Pencil className="mr-2 h-4 w-4" /> Sửa
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TaskHeader task={task} />
          {task.description && (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Mô tả
              </h3>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {task.description}
              </p>
            </section>
          )}

          <TaskChecklistEditor
            taskId={task.id}
            items={task.checklist}
            canManage={internal}
          />

          <TaskCommentsThread
            taskId={task.id}
            comments={comments}
            currentUserId={userId}
            canPostInternal={internal}
            canPostCustomer={true}
          />
        </div>
        <div className="space-y-4">
          <TaskMetaPanel task={task} />
          {internal && (
            <TaskTransitions
              taskId={task.id}
              status={task.status}
              isAssignee={isAssignee}
              isReviewer={isReviewer}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TaskHeader({ task }: { task: TaskDetail }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
            STATUS_TONE[task.status],
          )}
        >
          {TASK_STATUS_LABEL[task.status] ?? task.status}
        </span>
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            PRIORITY_TONE[task.priority],
          )}
        >
          Ưu tiên: {TASK_PRIORITY_LABEL[task.priority] ?? task.priority}
        </span>
        {task.is_extra && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <Sparkles className="h-3 w-3" />
            Phát sinh
            {task.extra_source && ` · ${EXTRA_SOURCE_LABEL[task.extra_source] ?? task.extra_source}`}
          </span>
        )}
        {task.is_visible_to_customer ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <Eye className="h-3 w-3" /> Khách thấy
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            <EyeOff className="h-3 w-3" /> Nội bộ
          </span>
        )}
      </div>
    </section>
  );
}

function TaskMetaPanel({ task }: { task: TaskDetail }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Thông tin</h3>
      <dl className="space-y-3 text-sm">
        <Row icon={Folder} label="Dự án">
          {task.project ? (
            <Link
              href={`/projects/${task.project.id}`}
              className="text-blue-700 hover:underline"
            >
              {task.project.name}
            </Link>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </Row>
        {task.milestone && (
          <Row icon={Folder} label="Milestone">
            {task.milestone.code && `${task.milestone.code} · `}
            {task.milestone.title}
          </Row>
        )}
        <Row icon={User} label="Người phụ trách">
          {task.assignee?.full_name ?? (
            <span className="text-slate-400">Chưa gán</span>
          )}
        </Row>
        <Row icon={User} label="Reviewer">
          {task.reviewer?.full_name ?? (
            <span className="text-slate-400">Chưa gán</span>
          )}
        </Row>
        <Row icon={CalendarClock} label="Deadline">
          {task.due_at ? (
            format(new Date(task.due_at), "dd/MM/yyyy HH:mm")
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </Row>
        {task.reporter && (
          <Row icon={AlertCircle} label="Reporter">
            {task.reporter.full_name}
          </Row>
        )}
      </dl>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
      </div>
    </div>
  );
}
