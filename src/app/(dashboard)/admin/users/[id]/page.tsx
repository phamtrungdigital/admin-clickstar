import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  ListChecks,
  Mail,
  Pencil,
  Phone,
  Ticket,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { RoleBadge } from "@/components/admin/role-badge";
import { ReassignButton } from "@/components/admin/reassign-dialog";
import { getUserById } from "@/lib/queries/users";
import { listInternalStaff } from "@/lib/queries/customers";
import { roleLabel } from "@/lib/validation/users";

export const metadata = { title: "Chi tiết người dùng | Portal.Clickstar.vn" };

const ASSIGNMENT_LABEL: Record<string, string> = {
  account_manager: "Account Manager",
  implementer: "Triển khai",
  support: "CSKH",
  accountant: "Kế toán",
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, staff] = await Promise.all([
    getUserById(id).catch(() => null),
    listInternalStaff().catch(() => []),
  ]);
  if (!user) notFound();

  const candidates = staff.filter((s) => s.id !== user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={user.full_name || "(chưa đặt tên)"}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Người dùng", href: "/admin/users" },
          { label: user.full_name || "Chi tiết" },
        ]}
        actions={
          <>
            <Link
              href="/admin/users"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-4",
              )}
            >
              Quay lại
            </Link>
            <Link
              href={`/admin/users/${user.id}/edit`}
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
        <RoleBadge role={user.internal_role} audience={user.audience} />
        {user.is_active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Đang hoạt động
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Đã vô hiệu hoá
          </span>
        )}
        <span className="text-xs text-slate-400">
          Tạo {format(new Date(user.created_at), "dd/MM/yyyy HH:mm")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
              Khách hàng phụ trách
            </h3>
            {user.assignments.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa phụ trách khách hàng nào.</p>
            ) : (
              <div className="space-y-2">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Đang phụ trách <strong>{user.assignments.length}</strong>{" "}
                    khách hàng.
                  </p>
                  <ReassignButton
                    fromUserId={user.id}
                    fromUserName={user.full_name || "user này"}
                    customersCount={user.assignments.length}
                    candidates={candidates.map((c) => ({
                      id: c.id,
                      full_name: c.full_name,
                      internal_role: c.internal_role,
                    }))}
                  />
                </div>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {user.assignments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          {a.company ? (
                            <Link
                              href={`/customers/${a.company.id}`}
                              className="font-medium text-slate-900 hover:text-blue-700"
                            >
                              {a.company.name}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {a.company?.code && (
                            <p className="font-mono text-xs text-slate-500">
                              {a.company.code}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">
                          {ASSIGNMENT_LABEL[a.role] ?? a.role}
                        </span>
                        {a.is_primary && (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700">
                            Chính
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <WorkloadCard
              icon={ListChecks}
              tone="amber"
              label="Task đang xử lý"
              value={user.open_tasks_count}
            />
            <WorkloadCard
              icon={Ticket}
              tone="violet"
              label="Ticket đang mở"
              value={user.open_tickets_count}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              Thông tin
            </h3>
            <dl className="space-y-3 text-sm">
              <Row icon={Mail} label="Email" value={user.email ?? "—"} />
              <Row icon={Phone} label="Số điện thoại" value={user.phone ?? "—"} />
              <Row
                icon={Building2}
                label="Vai trò"
                value={
                  user.audience === "customer"
                    ? "Khách hàng"
                    : roleLabel(user.internal_role)
                }
              />
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Lịch sử
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Tạo lúc</dt>
                <dd className="text-slate-800">
                  {format(new Date(user.created_at), "dd/MM/yyyy HH:mm")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Cập nhật</dt>
                <dd className="text-slate-800">
                  {format(new Date(user.updated_at), "dd/MM/yyyy HH:mm")}
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
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-sm font-medium text-slate-800 text-right break-words">
          {value}
        </dd>
      </div>
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
};

function WorkloadCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "amber" | "violet";
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
            TONE_BG[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
