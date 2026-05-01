import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, FolderKanban, User } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { listProjects, type ProjectListItem } from "@/lib/queries/projects";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dự án | Portal.Clickstar.vn" };

const STATUS_LABEL: Record<string, string> = {
  not_started: "Chưa bắt đầu",
  active: "Đang thực hiện",
  awaiting_customer: "Chờ phản hồi",
  awaiting_review: "Chờ duyệt",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
};

const STATUS_TONE: Record<string, string> = {
  not_started: "bg-slate-50 text-slate-700 ring-slate-200",
  active: "bg-blue-50 text-blue-700 ring-blue-200",
  awaiting_customer: "bg-amber-50 text-amber-700 ring-amber-200",
  awaiting_review: "bg-violet-50 text-violet-700 ring-violet-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  paused: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default async function ProjectsPage() {
  const { profile } = await getCurrentUser();
  const canManage = isInternal(profile);

  let rows: ProjectListItem[] = [];
  let loadError: string | null = null;
  try {
    const result = await listProjects({ pageSize: 50 });
    rows = result.rows;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dự án"
        description={
          canManage
            ? "Tất cả dự án dịch vụ đang triển khai cho khách hàng. Mỗi dự án sinh ra từ template đã được fork."
            : "Các dự án dịch vụ Clickstar đang triển khai cho doanh nghiệp bạn."
        }
        breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Dự án" }]}
      />

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {loadError}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState canManage={canManage} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((project) => (
            <ProjectCard key={project.id} project={project} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ canManage }: { canManage: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <FolderKanban className="mx-auto h-10 w-10 text-slate-300" />
      <h3 className="mt-3 text-base font-semibold text-slate-900">
        Chưa có dự án nào
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        {canManage ? (
          <>
            Vào{" "}
            <Link href="/contracts" className="font-medium text-blue-700 hover:underline">
              Hợp đồng
            </Link>{" "}
            → mở 1 hợp đồng → bấm{" "}
            <strong>"Tạo dự án từ template"</strong> để fork template thành dự án.
          </>
        ) : (
          "Khi Clickstar triển khai dịch vụ cho doanh nghiệp bạn, dự án sẽ hiện ở đây."
        )}
      </p>
    </div>
  );
}

function ProjectCard({
  project,
  canManage,
}: {
  project: ProjectListItem;
  canManage: boolean;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FolderKanban className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
              {project.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {canManage && project.company && (
                <>
                  {project.company.name} ·{" "}
                </>
              )}
              {project.contract && <>HĐ {project.contract.code ?? project.contract.name}</>}
              {project.template && (
                <> · Template {project.template.name} v{project.template.version}</>
              )}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
            STATUS_TONE[project.status] ?? STATUS_TONE.not_started,
          )}
        >
          {STATUS_LABEL[project.status] ?? project.status}
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-500">Tiến độ tổng</span>
          <span className="font-semibold text-slate-900">
            {project.progress_percent}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${project.progress_percent}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
        <div>
          <dt className="text-slate-500">Thời gian</dt>
          <dd className="mt-0.5 text-slate-700">
            {project.starts_at && project.ends_at
              ? `${format(new Date(project.starts_at), "dd/MM/yyyy")} — ${format(new Date(project.ends_at), "dd/MM/yyyy")}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">PM phụ trách</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1 text-slate-700">
            <User className="h-3 w-3 text-slate-400" />
            {project.pm?.full_name ?? <span className="text-slate-400">Chưa gán</span>}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {project.milestone_count} milestones · {project.task_count} tasks
        </span>
        <span className="inline-flex items-center text-blue-600 group-hover:translate-x-0.5 transition-transform">
          Xem chi tiết
          <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
