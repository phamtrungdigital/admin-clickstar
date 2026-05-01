import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertCircle,
  ArrowRight,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Info,
  MessageCircle,
  ShieldCheck,
  Ticket,
  User,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { getMockProject, type MockProject } from "@/lib/mock/projects";
import { cn } from "@/lib/utils";

export const metadata = { title: "Chi tiết dự án | Portal.Clickstar.vn" };

const MILESTONE_TONE: Record<
  MockProject["milestones"][number]["status"],
  { dot: string; pill: string; label: string }
> = {
  completed: {
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    label: "Đã hoàn thành",
  },
  in_progress: {
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 ring-blue-200",
    label: "Đang thực hiện",
  },
  pending: {
    dot: "bg-slate-300",
    pill: "bg-slate-50 text-slate-600 ring-slate-200",
    label: "Sắp tới",
  },
};

const TICKET_LABEL: Record<MockProject["tickets"][number]["status"], string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  awaiting_customer: "Chờ phản hồi",
  resolved: "Đã giải quyết",
};

const TICKET_TONE: Record<MockProject["tickets"][number]["status"], string> = {
  new: "bg-slate-50 text-slate-600 ring-slate-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  awaiting_customer: "bg-amber-50 text-amber-700 ring-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default async function CustomerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getMockProject(id);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${project.service_label} · Hợp đồng ${project.contract_code}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Dự án", href: "/projects" },
          { label: project.name },
        ]}
      />

      <SnapshotBanner project={project} />

      {project.pending_actions.length > 0 && (
        <PendingActions actions={project.pending_actions} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProgressOverview project={project} />
          <MilestonesTimeline milestones={project.milestones} />
          <DeliverablesList deliverables={project.deliverables} />
        </div>
        <div className="space-y-6">
          <ProjectInfoCard project={project} />
          <RecentTickets tickets={project.tickets} />
          <ReportsList reports={project.reports} />
        </div>
      </div>
    </div>
  );
}

function SnapshotBanner({ project }: { project: MockProject }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-3 text-sm">
      <div className="flex items-center gap-2 text-blue-900">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-blue-600" />
        <span>
          Dữ liệu hiển thị từ <strong>snapshot đã duyệt</strong>, cập nhật{" "}
          {formatDistanceToNow(new Date(project.last_snapshot_at), {
            locale: vi,
            addSuffix: true,
          })}
          .
        </span>
      </div>
      <span className="text-xs text-blue-700">
        {format(new Date(project.last_snapshot_at), "dd/MM/yyyy HH:mm")}
      </span>
    </div>
  );
}

function PendingActions({
  actions,
}: {
  actions: MockProject["pending_actions"];
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-5">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-rose-600" />
        <h3 className="text-sm font-semibold text-rose-900">
          {actions.length} việc cần anh/chị xử lý
        </h3>
      </div>
      <ul className="space-y-3">
        {actions.map((action) => (
          <li
            key={action.id}
            className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-white px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">
                {action.label}
              </p>
              <p className="mt-1 text-xs text-slate-600">{action.description}</p>
              {action.due_at && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-rose-700">
                  <Clock className="h-3 w-3" />
                  Hạn: {format(new Date(action.due_at), "dd/MM/yyyy")}
                </p>
              )}
            </div>
            <Link
              href={action.href}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
            >
              Xử lý ngay
              <ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressOverview({ project }: { project: MockProject }) {
  const total = project.milestones.length;
  const done = project.milestones.filter((m) => m.status === "completed").length;
  const doing = project.milestones.filter((m) => m.status === "in_progress").length;
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
          <Stat label="Đã hoàn thành" value={done} dot="bg-emerald-500" />
          <Stat label="Đang thực hiện" value={doing} dot="bg-blue-500" />
          <Stat label="Sắp tới" value={pending} dot="bg-slate-300" />
        </dl>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
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

function MilestonesTimeline({
  milestones,
}: {
  milestones: MockProject["milestones"];
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
          const tone = MILESTONE_TONE[m.status];
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
                {m.status === "in_progress" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="mr-1.5 font-mono text-xs text-slate-500">
                      {m.code}
                    </span>
                    {m.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {format(new Date(m.starts_at), "dd/MM")} —{" "}
                    {format(new Date(m.ends_at), "dd/MM/yyyy")}
                  </p>
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
              {m.status === "in_progress" && (
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

function DeliverablesList({
  deliverables,
}: {
  deliverables: MockProject["deliverables"];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Sản phẩm bàn giao
        </h3>
        <span className="text-xs text-slate-500">
          {deliverables.length} mục
        </span>
      </div>
      <ul className="space-y-3">
        {deliverables.map((d) => (
          <li
            key={d.id}
            id={`deliverable-${d.id}`}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {d.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {d.filename} · Bàn giao {format(new Date(d.delivered_at), "dd/MM/yyyy")}{" "}
                  bởi {d.delivered_by} · {d.milestone_code}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {d.status === "approved" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Đã duyệt
                </span>
              )}
              {d.status === "rejected" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                  <X className="h-3 w-3" />
                  Đã từ chối
                </span>
              )}
              {d.status === "pending_approval" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  <Clock className="h-3 w-3" />
                  Chờ duyệt
                </span>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3 w-3" />
                Tải về
              </button>
              {d.status === "pending_approval" && (
                <>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3 w-3" />
                    Duyệt
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Từ chối
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectInfoCard({ project }: { project: MockProject }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Thông tin dự án</h3>
      <dl className="space-y-3 text-sm">
        <Row icon={CalendarRange} label="Thời gian">
          {format(new Date(project.starts_at), "dd/MM/yyyy")} —{" "}
          {format(new Date(project.ends_at), "dd/MM/yyyy")}
        </Row>
        <Row icon={User} label="PM phụ trách">
          {project.pm_name}
        </Row>
        <Row icon={Info} label="Hợp đồng">
          <Link
            href="/contracts"
            className="text-blue-700 hover:underline"
          >
            {project.contract_code}
          </Link>
        </Row>
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

function RecentTickets({ tickets }: { tickets: MockProject["tickets"] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Ticket gần đây
        </h3>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          Xem tất cả
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {tickets.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có ticket nào.</p>
      ) : (
        <ul className="space-y-2.5">
          {tickets.slice(0, 5).map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 rounded-md hover:bg-slate-50 px-2 py-1.5 -mx-2"
            >
              <Ticket className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">{t.title}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-400">{t.code}</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                      TICKET_TONE[t.status],
                    )}
                  >
                    {TICKET_LABEL[t.status]}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/tickets/new"
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Gửi yêu cầu mới
      </Link>
    </section>
  );
}

function ReportsList({ reports }: { reports: MockProject["reports"] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        Báo cáo định kỳ
      </h3>
      {reports.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có báo cáo nào.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {r.period_label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Phát hành {format(new Date(r.published_at), "dd/MM/yyyy")}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3 w-3" />
                Tải về
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
