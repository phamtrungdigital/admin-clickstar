import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Pencil, Tag } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { ServiceStatusBadge } from "@/components/services/service-status-badge";
import { getServiceById } from "@/lib/queries/services";

export const metadata = { title: "Chi tiết dịch vụ | Portal.Clickstar.vn" };

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getServiceById(id).catch(() => null);
  if (!service) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={service.name}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Dịch vụ", href: "/services" },
          { label: service.name },
        ]}
        actions={
          <>
            <Link
              href="/services"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}
            >
              Quay lại
            </Link>
            <Link
              href={`/services/${service.id}/edit`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-blue-600 px-4 text-white hover:bg-blue-700",
              )}
            >
              <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ServiceStatusBadge isActive={service.is_active} />
        {service.code && (
          <span className="font-mono text-xs text-slate-500">{service.code}</span>
        )}
        <span className="text-xs text-slate-400">
          Cập nhật {format(new Date(service.updated_at), "dd/MM/yyyy HH:mm")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Mô tả</h3>
            {service.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {service.description}
              </p>
            ) : (
              <p className="text-sm text-slate-400">Chưa có mô tả.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Cấu hình</h3>
            <dl className="space-y-3 text-sm">
              <Row icon={Tag} label="Danh mục" value={service.category ?? "—"} />
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Lịch sử</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Tạo lúc</dt>
                <dd className="text-slate-800">
                  {format(new Date(service.created_at), "dd/MM/yyyy HH:mm")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Cập nhật</dt>
                <dd className="text-slate-800">
                  {format(new Date(service.updated_at), "dd/MM/yyyy HH:mm")}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-sm font-medium text-slate-800 text-right">{value}</dd>
      </div>
    </div>
  );
}
