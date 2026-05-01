import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, FolderKanban, User } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { MOCK_PROJECTS, type MockProject } from "@/lib/mock/projects";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dự án | Portal.Clickstar.vn" };

const STATUS_LABEL: Record<MockProject["status"], string> = {
  in_progress: "Đang thực hiện",
  paused: "Tạm dừng",
  completed: "Hoàn thành",
};

const STATUS_TONE: Record<MockProject["status"], string> = {
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  paused: "bg-amber-50 text-amber-700 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default async function ProjectsPage() {
  const { profile } = await getCurrentUser();
  const canManage = isInternal(profile);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dự án"
        description={
          canManage
            ? "Tất cả dự án dịch vụ đang triển khai cho khách hàng (demo data — Phase 1 đang xây)."
            : "Các dự án dịch vụ Clickstar đang triển khai cho doanh nghiệp bạn."
        }
        breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Dự án" }]}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
        <strong>Demo dữ liệu</strong> — trang này hiển thị dữ liệu mô phỏng để
        anh/chị hình dung trải nghiệm khách hàng. Khi Phase 1 hoàn thiện, dữ
        liệu sẽ lấy từ snapshot đã duyệt.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MOCK_PROJECTS.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: MockProject }) {
  const pendingCount = project.pending_actions.length;
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
          <div>
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
              {project.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {project.service_label} · HĐ {project.contract_code}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
            STATUS_TONE[project.status],
          )}
        >
          {STATUS_LABEL[project.status]}
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
            {format(new Date(project.starts_at), "dd/MM/yyyy")} —{" "}
            {format(new Date(project.ends_at), "dd/MM/yyyy")}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">PM phụ trách</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1 text-slate-700">
            <User className="h-3 w-3 text-slate-400" />
            {project.pm_name}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between text-xs">
        {pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {pendingCount} việc cần anh/chị xử lý
          </span>
        ) : (
          <span className="text-slate-400">Không có việc tồn đọng</span>
        )}
        <span className="inline-flex items-center text-blue-600 group-hover:translate-x-0.5 transition-transform">
          Xem chi tiết
          <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
