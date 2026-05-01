import { Check, Eye, Lock, Minus, Shield, ShieldCheck, ShieldUser } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata = { title: "Vai trò & Phân quyền | Portal.Clickstar.vn" };

type AccessLevel = "full" | "manage" | "scoped" | "view" | "none";

const ACCESS_META: Record<
  AccessLevel,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  full: {
    label: "Toàn quyền",
    tone: "bg-violet-50 text-violet-700 ring-violet-200",
    icon: ShieldCheck,
  },
  manage: {
    label: "Tạo / sửa / xoá",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: Check,
  },
  scoped: {
    label: "Theo phân công",
    tone: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: Shield,
  },
  view: {
    label: "Chỉ xem",
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Eye,
  },
  none: {
    label: "Không có",
    tone: "bg-slate-50 text-slate-400 ring-slate-200",
    icon: Minus,
  },
};

type Role = {
  key: string;
  label: string;
  summary: string;
};

const INTERNAL_ROLES: Role[] = [
  {
    key: "super_admin",
    label: "Super Admin",
    summary: "Toàn quyền hệ thống — chủ tài khoản Clickstar.",
  },
  {
    key: "admin",
    label: "Admin",
    summary: "Quản trị hệ thống, người dùng và dữ liệu.",
  },
  {
    key: "manager",
    label: "Manager",
    summary: "Quản lý nhóm — giao việc, theo dõi KPI, ký duyệt.",
  },
  {
    key: "staff",
    label: "Nhân viên triển khai",
    summary: "Thực thi công việc cụ thể được giao.",
  },
  {
    key: "support",
    label: "CSKH",
    summary: "Chăm sóc khách hàng, xử lý ticket.",
  },
  {
    key: "accountant",
    label: "Kế toán",
    summary: "Hợp đồng, thanh toán, công nợ.",
  },
];

const CUSTOMER_ROLES: Role[] = [
  {
    key: "owner",
    label: "Owner",
    summary: "Chủ doanh nghiệp khách hàng — xem toàn bộ data của họ.",
  },
  {
    key: "marketing_manager",
    label: "Marketing Manager",
    summary: "Theo dõi tiến độ, báo cáo, ticket.",
  },
  {
    key: "viewer",
    label: "Viewer",
    summary: "Chỉ xem báo cáo / tài liệu được chia sẻ.",
  },
];

type Scope = {
  key: string;
  label: string;
};

const SCOPES: Scope[] = [
  { key: "users", label: "Người dùng" },
  { key: "customers", label: "Khách hàng" },
  { key: "contracts", label: "Hợp đồng" },
  { key: "services", label: "Dịch vụ" },
  { key: "tasks", label: "Công việc" },
  { key: "tickets", label: "Ticket" },
  { key: "documents", label: "Tài liệu" },
  { key: "reports", label: "Báo cáo" },
  { key: "settings", label: "Cài đặt hệ thống" },
];

// Permission matrix per PRD §3. Source of truth: Supabase RLS policies in
// 0011_rls_policies.sql; this UI mirrors the rules for human reference only.
const MATRIX: Record<string, Record<string, AccessLevel>> = {
  super_admin: {
    users: "full",
    customers: "full",
    contracts: "full",
    services: "full",
    tasks: "full",
    tickets: "full",
    documents: "full",
    reports: "full",
    settings: "full",
  },
  admin: {
    users: "manage",
    customers: "manage",
    contracts: "manage",
    services: "manage",
    tasks: "manage",
    tickets: "manage",
    documents: "manage",
    reports: "view",
    settings: "manage",
  },
  manager: {
    users: "view",
    customers: "scoped",
    contracts: "scoped",
    services: "view",
    tasks: "scoped",
    tickets: "scoped",
    documents: "scoped",
    reports: "view",
    settings: "none",
  },
  staff: {
    users: "none",
    customers: "scoped",
    contracts: "scoped",
    services: "view",
    tasks: "scoped",
    tickets: "scoped",
    documents: "scoped",
    reports: "none",
    settings: "none",
  },
  support: {
    users: "none",
    customers: "scoped",
    contracts: "view",
    services: "view",
    tasks: "view",
    tickets: "scoped",
    documents: "scoped",
    reports: "none",
    settings: "none",
  },
  accountant: {
    users: "none",
    customers: "view",
    contracts: "manage",
    services: "view",
    tasks: "none",
    tickets: "none",
    documents: "scoped",
    reports: "view",
    settings: "none",
  },
};

const CUSTOMER_MATRIX: Record<string, Record<string, AccessLevel>> = {
  owner: {
    users: "none",
    customers: "view",
    contracts: "view",
    services: "view",
    tasks: "view",
    tickets: "manage",
    documents: "view",
    reports: "view",
    settings: "none",
  },
  marketing_manager: {
    users: "none",
    customers: "none",
    contracts: "none",
    services: "view",
    tasks: "view",
    tickets: "manage",
    documents: "view",
    reports: "view",
    settings: "none",
  },
  viewer: {
    users: "none",
    customers: "none",
    contracts: "none",
    services: "none",
    tasks: "none",
    tickets: "view",
    documents: "view",
    reports: "view",
    settings: "none",
  },
};

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vai trò & Phân quyền"
        description="Bảng tham chiếu quyền hạn của từng vai trò. Quy định gốc nằm ở Supabase RLS policies — trang này chỉ mô tả lại để dễ tra cứu."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Vai trò & Phân quyền" },
        ]}
      />

      <Legend />

      <RoleSection
        title="Nội bộ Clickstar"
        icon={ShieldUser}
        roles={INTERNAL_ROLES}
        matrix={MATRIX}
      />

      <RoleSection
        title="Khách hàng"
        icon={Lock}
        roles={CUSTOMER_ROLES}
        matrix={CUSTOMER_MATRIX}
      />

      <Note />
    </div>
  );
}

function Legend() {
  const items: AccessLevel[] = ["full", "manage", "scoped", "view", "none"];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Chú thích mức truy cập
      </p>
      <div className="flex flex-wrap gap-3">
        {items.map((level) => {
          const meta = ACCESS_META[level];
          const Icon = meta.icon;
          return (
            <div
              key={level}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                meta.tone,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        <strong>Theo phân công</strong> = chỉ thấy/sửa được khách hàng/dự án mà
        người này được phân công qua{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">
          company_assignments
        </code>
        .
      </p>
    </div>
  );
}

function RoleSection({
  title,
  icon: Icon,
  roles,
  matrix,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  matrix: Record<string, Record<string, AccessLevel>>;
}) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
      </h2>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">
                  Vai trò
                </th>
                {SCOPES.map((s) => (
                  <th
                    key={s.key}
                    className="whitespace-nowrap px-3 py-3 text-center font-semibold text-slate-700"
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role) => (
                <tr key={role.key} className="align-top">
                  <td className="sticky left-0 z-10 bg-white px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-medium text-slate-900">{role.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {role.summary}
                      </p>
                    </div>
                  </td>
                  {SCOPES.map((s) => {
                    const level = matrix[role.key]?.[s.key] ?? "none";
                    return (
                      <td key={s.key} className="px-3 py-4 text-center">
                        <AccessPill level={level} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AccessPill({ level }: { level: AccessLevel }) {
  const meta = ACCESS_META[level];
  const Icon = meta.icon;
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 ring-1 ring-inset",
        meta.tone,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function Note() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
      <p className="font-semibold">Lưu ý kỹ thuật</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
        <li>
          Quy định gốc nằm ở{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px]">
            supabase/migrations/0011_rls_policies.sql
          </code>{" "}
          — Postgres tự enforce, UI chỉ hiển thị/ẩn. Trang này chỉ là tài liệu.
        </li>
        <li>
          Đổi quyền: cập nhật RLS policy + migration mới + redeploy. Không có UI
          cho phép sửa quyền trực tiếp (nguyên tắc least-surprise + audit).
        </li>
        <li>
          Khách hàng A không thấy được dữ liệu khách hàng B — gate mọi access
          qua{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px]">
            company_id
          </code>{" "}
          /{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px]">
            project_id
          </code>{" "}
          (PRD §3).
        </li>
      </ul>
    </div>
  );
}
