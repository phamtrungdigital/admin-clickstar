import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  FileSignature,
  Package,
  ListChecks,
  Ticket,
  FolderOpen,
  Mail,
  MessageSquare,
  BarChart3,
  Workflow,
  ShieldUser,
  Settings,
  Bell,
  FolderKanban,
  ListTree,
} from "lucide-react";
import type { InternalRole } from "@/lib/database.types";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** internal roles allowed to see this item; undefined = all internal users */
  allowedRoles?: InternalRole[];
  children?: NavItem[];
};

// Role bundles — match PRD §3:
//   Manager+   = super_admin · admin · manager (full ops + admin views)
//   Doer       = + staff (triển khai, công việc)
//   CS-aware   = + support (CSKH cần thấy khách + ticket + tài liệu)
//   Money-aware = + accountant (kế toán xem hợp đồng + tài liệu + báo cáo)
const ROLES_MANAGER_PLUS: InternalRole[] = ["super_admin", "admin", "manager"];
const ROLES_OPS: InternalRole[] = ["super_admin", "admin", "manager", "staff"];
const ROLES_TICKET: InternalRole[] = [
  "super_admin",
  "admin",
  "manager",
  "staff",
  "support",
];
// Hợp đồng chứa thông tin tài chính nhạy cảm (giá trị, VAT...). Staff
// "follow khách hàng" thôi, không cần xem hợp đồng — anh chốt 2026-05-02.
const ROLES_CONTRACT: InternalRole[] = [
  "super_admin",
  "admin",
  "manager",
  "accountant",
];
const ROLES_ADMIN_ONLY: InternalRole[] = ["super_admin", "admin"];

export const internalNav: NavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  // Khách hàng: mọi role thấy (CSKH cần list khách, kế toán cần xem để gắn HĐ)
  { label: "Khách hàng", href: "/customers", icon: Users },
  // Hợp đồng: bỏ support (PRD §3 — support chỉ xem khách + ticket)
  {
    label: "Hợp đồng",
    href: "/contracts",
    icon: FileSignature,
    allowedRoles: ROLES_CONTRACT,
  },
  // Dự án: bỏ support + accountant — chỉ team triển khai
  {
    label: "Dự án",
    href: "/projects",
    icon: FolderKanban,
    allowedRoles: ROLES_OPS,
  },
  // Dịch vụ + Template: dữ liệu cấu hình hệ thống — chỉ manager+
  {
    label: "Dịch vụ",
    href: "/services",
    icon: Package,
    allowedRoles: ROLES_MANAGER_PLUS,
  },
  {
    label: "Template",
    href: "/templates",
    icon: ListTree,
    allowedRoles: ROLES_MANAGER_PLUS,
  },
  {
    label: "Vận hành",
    href: "/tasks",
    icon: ListChecks,
    children: [
      // Công việc: bỏ support + accountant
      {
        label: "Công việc",
        href: "/tasks",
        icon: ListChecks,
        allowedRoles: ROLES_OPS,
      },
      // Ticket: bỏ accountant
      {
        label: "Ticket",
        href: "/tickets",
        icon: Ticket,
        allowedRoles: ROLES_TICKET,
      },
      // Tài liệu: mọi role thấy (kế toán cần file HĐ, support cần file KH)
      { label: "Tài liệu", href: "/documents", icon: FolderOpen },
    ],
  },
  // Marketing & Automation: cấu hình kênh gửi — chỉ manager+
  {
    label: "Marketing & Automation",
    href: "/email",
    icon: Workflow,
    allowedRoles: ROLES_MANAGER_PLUS,
    children: [
      { label: "Email Marketing", href: "/email", icon: Mail },
      { label: "ZNS", href: "/zns", icon: MessageSquare },
      { label: "Automation", href: "/automation", icon: Workflow },
    ],
  },
  // Báo cáo: mọi role thấy (kế toán cần báo cáo công nợ sau này, support cần
  // báo cáo ticket xử lý...)
  { label: "Báo cáo", href: "/reports", icon: BarChart3 },
  {
    label: "Quản trị hệ thống",
    href: "/admin",
    icon: ShieldUser,
    allowedRoles: ROLES_ADMIN_ONLY,
    children: [
      { label: "Người dùng", href: "/admin/users", icon: Users },
      { label: "Vai trò & Phân quyền", href: "/admin/roles", icon: ShieldUser },
      { label: "Cài đặt hệ thống", href: "/admin/settings", icon: Settings },
      { label: "Nhật ký hoạt động", href: "/admin/activity", icon: ListChecks },
      { label: "Danh mục", href: "/admin/catalog", icon: FolderOpen },
    ],
  },
];

/**
 * Customer portal nav. Ticket-centric — the customer's primary loop is
 * "file ticket → wait for reply → acknowledge". /tickets/new is exposed as a
 * pinned CTA in the sidebar, not as a nav row.
 */
export const customerNav: NavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Ticket của tôi", href: "/tickets", icon: Ticket },
  { label: "Dự án", href: "/projects", icon: FolderKanban },
  { label: "Dịch vụ", href: "/services", icon: Package },
  { label: "Hợp đồng", href: "/contracts", icon: FileSignature },
  { label: "Tài liệu", href: "/documents", icon: FolderOpen },
  { label: "Thông báo", href: "/notifications", icon: Bell },
  { label: "Cài đặt", href: "/settings", icon: Settings },
];

export function filterNavByRole(
  items: NavItem[],
  role: InternalRole | null,
): NavItem[] {
  return items
    .filter(
      (item) => !item.allowedRoles || (role && item.allowedRoles.includes(role)),
    )
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavByRole(item.children, role)
        : undefined,
    }));
}
