import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowRight,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Info,
  ListChecks,
  User,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { getProjectById, type ProjectDetail } from "@/lib/queries/projects";
import {
  getLatestPublishedSnapshot,
  listSnapshotsForProject,
  readSnapshotPayload,
} from "@/lib/queries/snapshots";
import { SnapshotsPanel } from "@/components/snapshots/snapshots-panel";
import { ProjectDocumentsSection } from "@/components/documents/project-documents-section";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

export const metadata = { title: "Chi tiết dự án | Portal.Clickstar.vn" };

const STATUS_LABEL: Record<string, string> = {
  not_started: "Chưa bắt đầu",
  active: "Đang thực hiện",
  awaiting_customer: "Chờ phản hồi",
  awaiting_review: "Chờ duyệt",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
};

const MILESTONE_TONE: Record<
  string,
  { dot: string; pill: string; label: string }
> = {
  completed: {
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    label: "Đã hoàn thành",
  },
  active: {
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 ring-blue-200",
    label: "Đang thực hiện",
  },
  awaiting_customer: {
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700 ring-amber-200",
    label: "Chờ phản hồi",
  },
  awaiting_review: {
    dot: "bg-violet-500",
    pill: "bg-violet-50 text-violet-700 ring-violet-200",
    label: "Chờ duyệt",
  },
  paused: {
    dot: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700 ring-rose-200",
    label: "Tạm dừng",
  },
  not_started: {
    dot: "bg-slate-300",
    pill: "bg-slate-50 text-slate-600 ring-slate-200",
    label: "Sắp tới",
  },
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await getCurrentUser();
  const internal = isInternal(profile);
  const canApprove =
    internal &&
    (profile?.internal_role === "super_admin" ||
      profile?.internal_role === "admin");

  const project = await getProjectById(id).catch(() => null);
  if (!project) notFound();

  if (!internal) {
    return <CustomerView projectId={project.id} project={project} />;
  }

  const snapshots = await listSnapshotsForProject(project.id).catch(() => []);
  const stats = computeStats(project);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${project.contract?.name ?? "—"}${project.template ? ` · Template ${project.template.name} v${project.template.version}` : ""}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Dự án", href: "/projects" },
          { label: project.name },
        ]}
      />

      <SnapshotsPanel
        projectId={project.id}
        snapshots={snapshots}
        canApprove={canApprove}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProgressOverview project={project} stats={stats} />
          <MilestonesSection milestones={project.milestones} />
          <TasksPreview tasks={project.tasks} />
          <ProjectDocumentsSection
            projectId={project.id}
            companyId={project.company?.id}
            canManage
          />
        </div>
        <div className="space-y-6">
          <ProjectInfoCard project={project} />
        </div>
      </div>
    </div>
  );
}

async function CustomerView({
  projectId,
  project,
}: {
  projectId: string;
  project: ProjectDetail;
}) {
  const snapshot = await getLatestPublishedSnapshot(projectId).catch(() => null);
  const payload = snapshot ? readSnapshotPayload(snapshot.payload) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={
          project.contract?.name ?? `Dự án dịch vụ Clickstar đang triển khai`
        }
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Dự án", href: "/projects" },
          { label: project.name },
        ]}
      />

      {snapshot && payload ? (
        <CustomerSnapshotBanner snapshot={snapshot} />
      ) : (
        <CustomerNoSnapshotBanner />
      )}

      {payload ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <CustomerProgressOverview payload={payload} />
            <CustomerMilestones milestones={payload.milestones} />
            {payload.tasks.length > 0 && (
              <CustomerTasksPreview tasks={payload.tasks} />
            )}
            <ProjectDocumentsSection
              projectId={project.id}
              canManage={false}
            />
          </div>
          <div className="space-y-6">
            <ProjectInfoCard project={project} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CustomerSnapshotBanner({
  snapshot,
}: {
  snapshot: { approved_at: string | null; created_at: string };
}) {
  const stamp = snapshot.approved_at ?? snapshot.created_at;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-3 text-sm">
      <div className="flex items-center gap-2 text-blue-900">
        <svg
          className="h-4 w-4 flex-shrink-0 text-blue-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 12 11 14 15 10" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        <span>
          Dữ liệu hiển thị từ <strong>snapshot đã duyệt</strong>, cập nhật{" "}
          {formatDistanceToNow(new Date(stamp), {
            locale: vi,
            addSuffix: true,
          })}
          .
        </span>
      </div>
      <span className="text-xs text-blue-700">
        {format(new Date(stamp), "dd/MM/yyyy HH:mm")}
      </span>
    </div>
  );
}

function CustomerNoSnapshotBanner() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4 text-sm text-amber-900">
      <strong>Đang chờ Clickstar tạo bản tổng hợp đầu tiên.</strong>
      <br />
      Khi PM phụ trách công bố bản tổng hợp tiến độ, anh/chị sẽ thấy chi tiết
      milestones và task ở đây.
    </div>
  );
}

function CustomerProgressOverview({
  payload,
}: {
  payload: NonNullable<ReturnType<typeof readSnapshotPayload>>;
}) {
  const total = payload.milestones.length;
  const done = payload.milestones.filter((m) => m.status === "completed").length;
  const doing = payload.milestones.filter((m) => m.status === "active").length;
  const pending = total - done - doing;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        Tiến độ tổng thể
      </h3>
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="relative flex h-32 w-32 flex-shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeDasharray={`${payload.project.progress_percent} 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900">
              {payload.project.progress_percent}%
            </span>
            <span className="text-[11px] text-slate-500">Hoàn thành</span>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Đã hoàn thành" value={done} dot="bg-emerald-500" />
          <Stat label="Đang thực hiện" value={doing} dot="bg-blue-500" />
          <Stat label="Sắp tới" value={pending} dot="bg-slate-300" />
        </dl>
      </div>
    </section>
  );
}

function CustomerMilestones({
  milestones,
}: {
  milestones: NonNullable<ReturnType<typeof readSnapshotPayload>>["milestones"];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Các giai đoạn (Milestones)
        </h3>
        <span className="text-xs text-slate-500">
          {milestones.length} giai đoạn
        </span>
      </div>
      <ol className="relative space-y-5 border-l border-slate-200 pl-6">
        {milestones.map((m) => {
          const tone = MILESTONE_TONE[m.status] ?? MILESTONE_TONE.not_started;
          return (
            <li key={m.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white",
                  tone.dot,
                )}
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {m.code && (
                      <span className="mr-1.5 font-mono text-xs text-slate-500">
                        {m.code}
                      </span>
                    )}
                    {m.title}
                  </p>
                  {m.starts_at && m.ends_at && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {format(new Date(m.starts_at), "dd/MM")} —{" "}
                      {format(new Date(m.ends_at), "dd/MM/yyyy")}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                    tone.pill,
                  )}
                >
                  {tone.label}
                </span>
              </div>
              {m.status === "active" && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${m.progress_percent}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-600">
                    {m.progress_percent}%
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CustomerTasksPreview({
  tasks,
}: {
  tasks: NonNullable<ReturnType<typeof readSnapshotPayload>>["tasks"];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        Hạng mục công khai ({tasks.length})
      </h3>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-800">{t.title}</p>
              {t.due_at && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Hạn {format(new Date(t.due_at), "dd/MM/yyyy")}
                </p>
              )}
            </div>
            <TaskStatusBadge status={t.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function computeStats(project: ProjectDetail) {
  const total = project.milestones.length;
  const done = project.milestones.filter((m) => m.status === "completed").length;
  const doing = project.milestones.filter((m) => m.status === "active").length;
  const pending = total - done - doing;
  return { total, done, doing, pending };
}

function ProgressOverview({
  project,
  stats,
}: {
  project: ProjectDetail;
  stats: ReturnType<typeof computeStats>;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        Tiến độ tổng thể
      </h3>
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="relative flex h-32 w-32 flex-shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeDasharray={`${project.progress_percent} 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900">
              {project.progress_percent}%
            </span>
            <span className="text-[11px] text-slate-500">Hoàn thành</span>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Đã hoàn thành" value={stats.done} dot="bg-emerald-500" />
          <Stat label="Đang thực hiện" value={stats.doing} dot="bg-blue-500" />
          <Stat label="Sắp tới" value={stats.pending} dot="bg-slate-300" />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function MilestonesSection({
  milestones,
}: {
  milestones: ProjectDetail["milestones"];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Các giai đoạn (Milestones)
        </h3>
        <span className="text-xs text-slate-500">{milestones.length} giai đoạn</span>
      </div>
      {milestones.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          Dự án này chưa có milestone nào.
        </p>
      ) : (
        <ol className="relative space-y-5 border-l border-slate-200 pl-6">
          {milestones.map((m) => {
            const tone = MILESTONE_TONE[m.status] ?? MILESTONE_TONE.not_started;
            return (
              <li key={m.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white",
                    tone.dot,
                  )}
                >
                  {m.status === "completed" && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </span>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {m.code && (
                        <span className="mr-1.5 font-mono text-xs text-slate-500">
                          {m.code}
                        </span>
                      )}
                      {m.title}
                    </p>
                    {m.starts_at && m.ends_at && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {format(new Date(m.starts_at), "dd/MM")} —{" "}
                        {format(new Date(m.ends_at), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                      tone.pill,
                    )}
                  >
                    {tone.label}
                  </span>
                </div>
                {m.status === "active" && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${m.progress_percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-600">
                      {m.progress_percent}%
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function TasksPreview({ tasks }: { tasks: ProjectDetail["tasks"] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          <ListChecks className="mr-1.5 inline h-4 w-4 text-blue-600" />
          Tasks ({tasks.length})
        </h3>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          Xem tất cả
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          Chưa có task nào trong dự án này.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.slice(0, 8).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {t.title}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  {t.due_at && (
                    <>
                      <Clock className="h-3 w-3" />
                      {format(new Date(t.due_at), "dd/MM/yyyy")}
                    </>
                  )}
                  {t.is_extra && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                      Phát sinh
                    </span>
                  )}
                </p>
              </div>
              <TaskStatusBadge status={t.status} />
            </li>
          ))}
          {tasks.length > 8 && (
            <li className="text-center text-xs text-slate-500">
              ... và {tasks.length - 8} task khác
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: string; label: string }> = {
    todo: { tone: "bg-slate-100 text-slate-700 ring-slate-200", label: "Mới tạo" },
    assigned: { tone: "bg-sky-50 text-sky-700 ring-sky-200", label: "Đã giao" },
    in_progress: { tone: "bg-blue-50 text-blue-700 ring-blue-200", label: "Đang làm" },
    blocked: { tone: "bg-rose-50 text-rose-700 ring-rose-200", label: "Bị chặn" },
    awaiting_review: { tone: "bg-violet-50 text-violet-700 ring-violet-200", label: "Chờ duyệt" },
    awaiting_customer: { tone: "bg-amber-50 text-amber-700 ring-amber-200", label: "Chờ khách" },
    returned: { tone: "bg-orange-50 text-orange-700 ring-orange-200", label: "Trả về" },
    done: { tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Hoàn thành" },
    cancelled: { tone: "bg-slate-100 text-slate-500 ring-slate-200", label: "Đã huỷ" },
  };
  const m = map[status] ?? map.todo;
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        m.tone,
      )}
    >
      {m.label}
    </span>
  );
}

function ProjectInfoCard({ project }: { project: ProjectDetail }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Thông tin dự án</h3>
      <dl className="space-y-3 text-sm">
        <Row icon={Info} label="Trạng thái">
          {STATUS_LABEL[project.status] ?? project.status}
        </Row>
        <Row icon={CalendarRange} label="Thời gian">
          {project.starts_at && project.ends_at
            ? `${format(new Date(project.starts_at), "dd/MM/yyyy")} — ${format(new Date(project.ends_at), "dd/MM/yyyy")}`
            : "—"}
        </Row>
        <Row icon={User} label="PM phụ trách">
          {project.pm?.full_name ?? <span className="text-slate-400">Chưa gán</span>}
        </Row>
        {project.contract && (
          <Row icon={Users} label="Hợp đồng">
            <Link
              href={`/contracts/${project.contract.id}`}
              className="text-blue-700 hover:underline"
            >
              {project.contract.code ?? project.contract.name}
            </Link>
          </Row>
        )}
        {project.template && (
          <Row icon={CheckCircle2} label="Template gốc">
            {project.template.name} v{project.template.version}
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
