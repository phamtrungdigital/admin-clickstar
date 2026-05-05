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
import {
  listActiveCompletionsByMilestoneIds,
  listCommentsByMilestoneIds,
  listCustomerCompletionMetaByProject,
} from "@/lib/queries/milestones";
import { SnapshotsPanel } from "@/components/snapshots/snapshots-panel";
import { ProjectDocumentsSection } from "@/components/documents/project-documents-section";
import { MilestoneCard } from "@/components/projects/milestone-card";
import {
  ProjectPmPicker,
  type StaffOption,
} from "@/components/projects/project-pm-picker";
import {
  ProjectSchedulingModePicker,
  SchedulingModeBadge,
} from "@/components/projects/project-scheduling-mode-picker";
import { createClient } from "@/lib/supabase/server";
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
  const { id: userId, profile } = await getCurrentUser();
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

  // Load snapshots + milestone comments + active completions cùng lúc —
  // milestones đã có sẵn trong project detail, dữ liệu phụ load batch theo
  // milestone IDs (tránh N+1).
  const milestoneIds = project.milestones.map((m) => m.id);
  const [snapshots, commentsByMilestone, completionsByMilestone] =
    await Promise.all([
      listSnapshotsForProject(project.id).catch(() => []),
      listCommentsByMilestoneIds(milestoneIds).catch(
        () => new Map<string, never[]>(),
      ),
      listActiveCompletionsByMilestoneIds(milestoneIds).catch(
        () => new Map(),
      ),
    ]);
  const stats = computeStats(project);
  const isAdminLevel =
    profile?.internal_role === "super_admin" ||
    profile?.internal_role === "admin";
  const canManagePm =
    isAdminLevel || profile?.internal_role === "manager";

  // Staff options cho PM picker — chỉ load khi user có quyền edit để
  // tránh leak data cho staff thường.
  let staffOptions: StaffOption[] = [];
  if (canManagePm) {
    const supabase = await createClient();
    const { data: staffRows } = await supabase
      .from("profiles")
      .select("id, full_name, internal_role")
      .eq("audience", "internal")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name", { ascending: true });
    staffOptions = (staffRows ?? []) as StaffOption[];
  }

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
          {project.scheduling_mode === "rolling" ? (
            <RollingOverview stats={stats} />
          ) : (
            <ProgressOverview project={project} stats={stats} />
          )}
          <MilestonesSection
            milestones={project.milestones}
            tasks={project.tasks}
            commentsByMilestone={commentsByMilestone}
            completionsByMilestone={completionsByMilestone}
            currentUserId={userId}
            companyId={project.company?.id ?? null}
            isAdmin={isAdminLevel}
          />
          {/* TasksPreview bỏ — phương án C, đầu việc chi tiết hiện trong
              MilestoneCard (toggle "Hiện đầu việc"). Nhân viên muốn xem
              tổng thể đầu việc của mình thì vào /tasks. */}
          <ProjectDocumentsSection
            projectId={project.id}
            companyId={project.company?.id}
            canManage
          />
        </div>
        <div className="space-y-6">
          <ProjectInfoCard
            project={project}
            staffOptions={staffOptions}
            canManagePm={canManagePm}
          />
        </div>
      </div>
    </div>
  );
}

async function CustomerView({
  projectId: _projectId,
  project,
}: {
  projectId: string;
  project: ProjectDetail;
}) {
  // Customer view giờ dùng LIVE data từ project.milestones thay vì
  // snapshot — yêu cầu UX của anh: khách phải thấy đầy đủ tiến độ ngay
  // khi nhân viên cập nhật, không cần chờ PM publish snapshot.
  // Vẫn ẩn các thông tin internal: edit form, comment thread, evidence
  // chi tiết của completion (proof file/link), tasks (đầu việc).
  //
  // Completion meta: dùng RPC SECURITY DEFINER (migration 0040) để chỉ
  // expose ngày hoàn thành + tên người báo (KHÔNG có summary/attachments
  // — proof internal-only).
  const completionMetaByMilestone = await listCustomerCompletionMetaByProject(
    project.id,
  ).catch(() => new Map());

  // PostgREST nested embed `pm:profiles!fk(id, full_name)` đôi khi trả
  // null cho field nếu RLS policy phức tạp. Fallback explicit fetch nếu
  // project.pm_id có set nhưng project.pm null — đảm bảo customer luôn
  // thấy PM nếu họ có quyền.
  let resolvedPm = project.pm;
  if (!resolvedPm && project.pm_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", project.pm_id)
      .maybeSingle();
    if (data) {
      resolvedPm = { id: data.id as string, full_name: data.full_name as string };
    }
  }
  const projectWithPm: ProjectDetail = { ...project, pm: resolvedPm };

  const stats = computeStats(project);

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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {projectWithPm.scheduling_mode === "rolling" ? (
            <RollingOverview stats={stats} />
          ) : (
            <ProgressOverview project={projectWithPm} stats={stats} />
          )}
          <CustomerMilestonesLive
            milestones={projectWithPm.milestones}
            completionMetaByMilestone={completionMetaByMilestone}
            schedulingMode={projectWithPm.scheduling_mode}
          />
          <ProjectDocumentsSection projectId={projectWithPm.id} canManage={false} />
        </div>
        <div className="space-y-6">
          <ProjectInfoCard project={projectWithPm} />
        </div>
      </div>
    </div>
  );
}

/**
 * Overview cho project rolling (vận hành liên tục): ẩn donut tiến độ %,
 * thay bằng counter công việc + thông điệp "Dự án ongoing không có
 * deadline cuối — Clickstar liên tục triển khai theo nhu cầu của khách."
 */
function RollingOverview({
  stats,
}: {
  stats: ReturnType<typeof computeStats>;
}) {
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/30 p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Dự án vận hành liên tục
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Đây là dự án ongoing — Clickstar liên tục triển khai theo nhu cầu
            của khách, không có deadline cuối.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Đã hoàn thành" value={stats.done} dot="bg-emerald-500" />
        <Stat label="Đang thực hiện" value={stats.doing} dot="bg-blue-500" />
        <Stat label="Sắp tới" value={stats.pending} dot="bg-slate-300" />
      </dl>
    </section>
  );
}

/**
 * Customer-facing milestone list — live data, ẩn internal details:
 *   - KHÔNG hiện edit form / nút đánh dấu hoàn thành
 *   - KHÔNG hiện comment thread (internal-only)
 *   - KHÔNG hiện tasks (đầu việc, theo phương án C)
 *   - KHÔNG lộ summary/proof của completion record
 *   - CÓ hiện: code, title, date range, mô tả ngắn, status pill,
 *     ngày hoàn thành (nếu đã nghiệm thu) và tên người phụ trách báo.
 */
function CustomerMilestonesLive({
  milestones,
  completionMetaByMilestone,
  schedulingMode,
}: {
  milestones: ProjectDetail["milestones"];
  completionMetaByMilestone: Awaited<
    ReturnType<typeof listCustomerCompletionMetaByProject>
  >;
  schedulingMode: ProjectDetail["scheduling_mode"];
}) {
  // Rolling/manual: không hiện ngày cho từng milestone (vì có thể null)
  const showDates = schedulingMode === "auto";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Tiến độ công việc
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Cập nhật trực tiếp khi đội ngũ Clickstar tiến hành công việc.
          </p>
        </div>
        <span className="text-xs text-slate-500">
          {milestones.length} công việc
        </span>
      </div>

      {milestones.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          Đội ngũ Clickstar chuẩn bị triển khai. Anh/chị sẽ thấy tiến độ chi
          tiết tại đây ngay khi bắt đầu.
        </p>
      ) : (
        <ol className="relative space-y-5 border-l border-slate-200 pl-6">
          {milestones.map((m) => {
            const tone = MILESTONE_TONE[m.status] ?? MILESTONE_TONE.not_started;
            const completionMeta = completionMetaByMilestone.get(m.id);
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {m.code && (
                        <span className="mr-1.5 font-mono text-xs text-slate-500">
                          {m.code}
                        </span>
                      )}
                      {m.title}
                    </p>
                    {showDates && m.starts_at && m.ends_at && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {format(new Date(m.starts_at), "dd/MM")} —{" "}
                        {format(new Date(m.ends_at), "dd/MM/yyyy")}
                      </p>
                    )}
                    {m.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {m.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                      tone.pill,
                    )}
                  >
                    {tone.label}
                  </span>
                </div>

                {/* Progress bar khi đang thực hiện */}
                {m.status === "active" && (
                  <div className="mt-3 flex items-center gap-2">
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

                {/* Khi đã hoàn thành: hiện 1 dòng "Đã nghiệm thu bởi
                    [Tên] lúc [date]" — qua RPC customer-safe, KHÔNG lộ
                    summary/proof của completion (chỉ internal mới xem). */}
                {m.status === "completed" && completionMeta && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <Check className="h-3 w-3" />
                    Đã nghiệm thu
                    {completionMeta.completer_full_name && (
                      <>
                        {" "}bởi{" "}
                        <strong>{completionMeta.completer_full_name}</strong>
                      </>
                    )}{" "}
                    ·{" "}
                    {format(
                      new Date(completionMeta.completed_at),
                      "dd/MM/yyyy",
                    )}
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
      các công việc ở đây.
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
        <h3 className="text-sm font-semibold text-slate-900">Công việc</h3>
        <span className="text-xs text-slate-500">
          {milestones.length} công việc
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

// Reserved cho future re-enable — phương án C bỏ TasksPreview khỏi UI
// mặc định, nếu sau này cần expose lại thì re-wire.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _CustomerTasksPreview({
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
  tasks,
  commentsByMilestone,
  completionsByMilestone,
  currentUserId,
  companyId,
  isAdmin,
}: {
  milestones: ProjectDetail["milestones"];
  tasks: ProjectDetail["tasks"];
  commentsByMilestone: Awaited<ReturnType<typeof listCommentsByMilestoneIds>>;
  completionsByMilestone: Awaited<
    ReturnType<typeof listActiveCompletionsByMilestoneIds>
  >;
  currentUserId: string;
  companyId: string | null;
  isAdmin: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Công việc</h3>
        <span className="text-xs text-slate-500">
          {milestones.length} công việc · click để mở chi tiết
        </span>
      </div>
      {milestones.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          Dự án này chưa có công việc nào.
        </p>
      ) : (
        <ol className="relative space-y-5 border-l border-slate-200 pl-6">
          {milestones.map((m, idx) => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              tasks={tasks.filter((t) => t.milestone_id === m.id)}
              comments={commentsByMilestone.get(m.id) ?? []}
              completion={completionsByMilestone.get(m.id) ?? null}
              currentUserId={currentUserId}
              companyId={companyId}
              isAdmin={isAdmin}
              isLast={idx === milestones.length - 1}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _TasksPreview({ tasks }: { tasks: ProjectDetail["tasks"] }) {
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

function ProjectInfoCard({
  project,
  staffOptions,
  canManagePm,
}: {
  project: ProjectDetail;
  staffOptions?: StaffOption[];
  canManagePm?: boolean;
}) {
  const mode = project.scheduling_mode;
  const showDates = mode === "auto";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Thông tin dự án</h3>
      <dl className="space-y-3 text-sm">
        <Row icon={Info} label="Trạng thái">
          {STATUS_LABEL[project.status] ?? project.status}
        </Row>
        <Row icon={CalendarRange} label="Loại lịch trình">
          {canManagePm ? (
            <ProjectSchedulingModePicker
              projectId={project.id}
              currentMode={mode}
              canManage
            />
          ) : (
            <SchedulingModeBadge mode={mode} />
          )}
        </Row>
        {showDates && (
          <Row icon={CalendarRange} label="Thời gian">
            {project.starts_at && project.ends_at
              ? `${format(new Date(project.starts_at), "dd/MM/yyyy")} — ${format(new Date(project.ends_at), "dd/MM/yyyy")}`
              : "—"}
          </Row>
        )}
        <Row icon={User} label="PM phụ trách">
          <ProjectPmPicker
            projectId={project.id}
            currentPm={project.pm}
            staffOptions={staffOptions ?? []}
            canManage={canManagePm ?? false}
          />
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
