import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarRange,
  ChevronLeft,
  Folder,
  Pencil,
  ShieldCheck,
  User,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReportTransitions } from "@/components/reports/report-transitions";
import { getReportById } from "@/lib/queries/reports";
import { renderMarkdown } from "@/lib/markdown";
import { REPORT_STATUS_LABEL } from "@/lib/validation/reports";
import type { ReportStatus } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";

export const metadata = { title: "Chi tiết báo cáo | Portal.Clickstar.vn" };

const STATUS_TONE: Record<ReportStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  pending_approval: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await getCurrentUser();
  const internal = isInternal(profile);
  const isAdmin =
    profile?.internal_role === "super_admin" ||
    profile?.internal_role === "admin";

  const report = await getReportById(id).catch(() => null);
  if (!report) notFound();

  const canEdit =
    internal && (report.status === "draft" || report.status === "rejected");

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.title}
        description={report.description ?? undefined}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Báo cáo", href: "/reports" },
          { label: report.title },
        ]}
        actions={
          <>
            <Link
              href="/reports"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-4",
              )}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Quay lại
            </Link>
            {canEdit && (
              <Link
                href={`/reports/${report.id}/edit`}
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

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
            STATUS_TONE[report.status],
          )}
        >
          {REPORT_STATUS_LABEL[report.status] ?? report.status}
        </span>
        {report.period_start && report.period_end && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <CalendarRange className="h-3 w-3" />
            {format(new Date(report.period_start), "dd/MM/yyyy")} —{" "}
            {format(new Date(report.period_end), "dd/MM/yyyy")}
          </span>
        )}
        {report.created_by_profile && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <User className="h-3 w-3" />
            PM: {report.created_by_profile.full_name}
          </span>
        )}
        {report.project && (
          <Link
            href={`/projects/${report.project.id}`}
            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
          >
            <Folder className="h-3 w-3" />
            {report.project.name}
          </Link>
        )}
        {report.approved_at &&
          (report.status === "approved" || report.status === "rejected") && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <ShieldCheck className="h-3 w-3" />
              {report.status === "approved" ? "Duyệt" : "Từ chối"}{" "}
              {format(new Date(report.approved_at), "dd/MM/yyyy HH:mm")}
              {report.approved_by_profile &&
                ` bởi ${report.approved_by_profile.full_name}`}
            </span>
          )}
      </div>

      {report.rejected_reason && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-900">
          <strong>Lý do từ chối:</strong> {report.rejected_reason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <article
          className="prose prose-slate max-w-none rounded-xl border border-slate-200 bg-white px-8 py-8 lg:col-span-2"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(report.content ?? "*(chưa có nội dung)*"),
          }}
        />
        <div>
          {internal && (
            <ReportTransitions
              reportId={report.id}
              status={report.status}
              isCreator={report.created_by === profile?.id}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </div>
  );
}
