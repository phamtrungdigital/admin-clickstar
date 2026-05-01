import { format } from "date-fns";
import {
  AlertCircle,
  Building2,
  Edit,
  FileSignature,
  Plus,
  Power,
  ShieldUser,
  Trash2,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/customers/pagination";
import { ActivityFilters } from "@/components/admin/activity-filters";
import { listAuditLogs, type AuditListItem } from "@/lib/audit";

export const metadata = { title: "Nhật ký hoạt động | Portal.Clickstar.vn" };

type SearchParams = {
  q?: string;
  action?: string;
  entity_type?: string;
  page?: string;
};

const ACTION_META: Record<
  string,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  create: {
    label: "Tạo",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: Plus,
  },
  update: {
    label: "Cập nhật",
    tone: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: Edit,
  },
  delete: {
    label: "Xoá",
    tone: "bg-rose-50 text-rose-700 ring-rose-200",
    icon: Trash2,
  },
  activate: {
    label: "Kích hoạt",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: Power,
  },
  deactivate: {
    label: "Vô hiệu hoá",
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Power,
  },
};

const ENTITY_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  profile: { label: "Người dùng", icon: User },
  company: { label: "Khách hàng", icon: Building2 },
  contract: { label: "Hợp đồng", icon: FileSignature },
  role_permission: { label: "Phân quyền", icon: ShieldUser },
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const search = params.q ?? "";
  const action = params.action ?? "all";
  const entity_type = params.entity_type ?? "all";

  let listResult: Awaited<ReturnType<typeof listAuditLogs>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 30,
  };
  let loadError: string | null = null;

  try {
    listResult = await listAuditLogs({ search, action, entity_type, page });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhật ký hoạt động"
        description="Mọi thay đổi quan trọng trên hệ thống — tạo / cập nhật / xoá / phân quyền — đều được ghi lại để truy ngược."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Nhật ký hoạt động" },
        ]}
      />

      <ActivityFilters />

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : listResult.rows.length === 0 ? (
        <EmptyState />
      ) : (
        <ActivityFeed rows={listResult.rows} />
      )}

      {!loadError && listResult.total > 0 && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          basePath="/admin/activity"
          searchParams={{
            q: search || undefined,
            action: action !== "all" ? action : undefined,
            entity_type: entity_type !== "all" ? entity_type : undefined,
          }}
        />
      )}
    </div>
  );
}

function ActivityFeed({ rows }: { rows: AuditListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <ActivityRow key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

function ActivityRow({ row }: { row: AuditListItem }) {
  const actionMeta = ACTION_META[row.action] ?? {
    label: row.action,
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Edit,
  };
  const entityMeta = ENTITY_META[row.entity_type] ?? {
    label: row.entity_type,
    icon: Edit,
  };
  const ActionIcon = actionMeta.icon;
  const EntityIcon = entityMeta.icon;

  const userName = row.user?.full_name ?? "(không rõ)";
  const summary = describeChange(row);

  return (
    <li className="flex items-start gap-4 px-4 py-4 hover:bg-slate-50/50 sm:px-6">
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
          actionMeta.tone,
        )}
      >
        <ActionIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-slate-900">{userName}</span>
          <span className="text-slate-500">·</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
              actionMeta.tone,
            )}
          >
            {actionMeta.label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <EntityIcon className="h-3 w-3" />
            {entityMeta.label}
          </span>
          {row.company?.name && (
            <span className="text-xs text-slate-500">
              · KH: <span className="font-medium">{row.company.name}</span>
            </span>
          )}
        </div>
        {summary && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{summary}</p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          {format(new Date(row.created_at), "dd/MM/yyyy HH:mm:ss")}
          {row.ip_address && (
            <span className="ml-2">
              · IP <span className="font-mono">{row.ip_address}</span>
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

/** Human-readable summary for common action+entity combos. */
function describeChange(row: AuditListItem): string | null {
  const newVal = row.new_value as Record<string, unknown> | null;
  const oldVal = row.old_value as Record<string, unknown> | null;

  if (row.entity_type === "role_permission" && row.action === "update") {
    const role = newVal?.role as string | undefined;
    const scope = newVal?.scope as string | undefined;
    const newLevel = newVal?.level as string | undefined;
    const oldLevel = oldVal?.level as string | undefined;
    if (role && scope) {
      return `Đổi quyền ${role} × ${scope}: ${oldLevel ?? "—"} → ${newLevel ?? "—"}`;
    }
  }
  if (row.entity_type === "profile") {
    const name = (newVal?.full_name ?? oldVal?.full_name) as string | undefined;
    if (row.action === "create" && newVal) {
      return `Tạo tài khoản ${name ?? ""} (${newVal.audience}/${newVal.internal_role ?? "—"})`;
    }
    if (row.action === "update" && newVal) {
      const fields = Object.keys(newVal).join(", ");
      return `Cập nhật ${fields}`;
    }
    if (row.action === "delete") return "Xoá mềm tài khoản";
    if (row.action === "deactivate") return "Vô hiệu hoá tài khoản";
    if (row.action === "activate") return "Kích hoạt lại tài khoản";
  }
  if (row.entity_type === "company") {
    const name = (newVal?.name ?? oldVal?.name) as string | undefined;
    if (row.action === "create" && name) return `Tạo khách hàng "${name}"`;
    if (row.action === "delete") return "Xoá mềm khách hàng";
  }
  if (row.entity_type === "contract") {
    const name = (newVal?.name ?? oldVal?.name) as string | undefined;
    if (row.action === "create" && name) return `Tạo hợp đồng "${name}"`;
    if (row.action === "delete") return "Xoá mềm hợp đồng";
  }
  return null;
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <ShieldUser className="mx-auto h-10 w-10 text-slate-300" />
      <h3 className="mt-3 text-base font-semibold text-slate-900">
        Chưa có hoạt động
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Khi có ai đó tạo / cập nhật / xoá dữ liệu hoặc đổi phân quyền, hệ thống
        sẽ ghi vào đây.
      </p>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
        <div>
          <h3 className="text-sm font-semibold text-red-900">
            Không tải được nhật ký
          </h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
        </div>
      </div>
    </div>
  );
}
