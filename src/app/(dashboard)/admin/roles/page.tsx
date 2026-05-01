import { PageHeader } from "@/components/dashboard/page-header";
import { PermissionsMatrix } from "@/components/admin/permissions-matrix";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  listRolePermissions,
  type PermissionLevel,
} from "@/lib/permissions";

export const metadata = { title: "Vai trò & Phân quyền | Portal.Clickstar.vn" };

const INTERNAL_ROLES = [
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

const CUSTOMER_ROLES = [
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

const SCOPES = [
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

// Customer-side matrix is currently read-only (RLS gating is more complex).
const CUSTOMER_MATRIX: Record<string, Record<string, PermissionLevel>> = {
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

export default async function RolesPage() {
  const [{ profile }, rows] = await Promise.all([
    getCurrentUser(),
    listRolePermissions().catch(() => []),
  ]);

  // Build internal matrix from DB rows; missing entries default to 'none'.
  const internalMatrix: Record<string, Record<string, PermissionLevel>> = {};
  for (const role of INTERNAL_ROLES) {
    internalMatrix[role.key] = {};
    for (const scope of SCOPES) {
      internalMatrix[role.key][scope.key] = "none";
    }
  }
  for (const r of rows) {
    if (!internalMatrix[r.role]) internalMatrix[r.role] = {};
    internalMatrix[r.role][r.scope] = r.level;
  }

  const canEdit =
    profile?.audience === "internal" &&
    profile.internal_role === "super_admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vai trò & Phân quyền"
        description="Tích chọn quyền cho từng vai trò. Hard wall data isolation vẫn do RLS Postgres giữ — bảng này chỉ kiểm soát nút bấm + action ở app level."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Vai trò & Phân quyền" },
        ]}
      />

      <PermissionsMatrix
        internalRoles={INTERNAL_ROLES}
        customerRoles={CUSTOMER_ROLES}
        scopes={SCOPES}
        initialMatrix={internalMatrix}
        customerMatrix={CUSTOMER_MATRIX}
        canEdit={canEdit}
      />
    </div>
  );
}
