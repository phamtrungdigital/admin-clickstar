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

export const internalNav: NavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Khách hàng", href: "/customers", icon: Users },
  { label: "Hợp đồng", href: "/contracts", icon: FileSignature },
  { label: "Dịch vụ", href: "/services", icon: Package },
  { label: "Công việc", href: "/tasks", icon: ListChecks },
  { label: "Ticket", href: "/tickets", icon: Ticket },
  { label: "Tài liệu", href: "/documents", icon: FolderOpen },
  {
    label: "Marketing & Automation",
    href: "/email",
    icon: Workflow,
    children: [
      { label: "Email Marketing", href: "/email", icon: Mail },
      { label: "ZNS", href: "/zns", icon: MessageSquare },
      { label: "Automation", href: "/automation", icon: Workflow },
    ],
  },
  { label: "Báo cáo", href: "/reports", icon: BarChart3 },
  {
    label: "Quản trị hệ thống",
    href: "/admin",
    icon: ShieldUser,
    allowedRoles: ["super_admin", "admin"],
    children: [
      { label: "Người dùng", href: "/admin/users", icon: Users },
      { label: "Vai trò & Phân quyền", href: "/admin/roles", icon: ShieldUser },
      { label: "Cài đặt hệ thống", href: "/admin/settings", icon: Settings },
      { label: "Nhật ký hoạt động", href: "/admin/activity", icon: ListChecks },
      { label: "Danh mục", href: "/admin/catalog", icon: FolderOpen },
    ],
  },
  { label: "Cài đặt", href: "/settings", icon: Settings },
];

/**
 * Customer portal nav (Phase 2 — placeholder for now). Customers see far fewer
 * items and only data scoped to their company.
 */
export const customerNav: NavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Dịch vụ đang dùng", href: "/services", icon: Package },
  { label: "Công việc", href: "/tasks", icon: ListChecks },
  { label: "Ticket", href: "/tickets", icon: Ticket },
  { label: "Tài liệu", href: "/documents", icon: FolderOpen },
  { label: "Báo cáo", href: "/reports", icon: BarChart3 },
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
