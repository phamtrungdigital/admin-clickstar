import "server-only";

import { createClient } from "@/lib/supabase/server";

export type InternalDashboardStats = {
  activeCustomers: number;
  activeContracts: number;
  openTickets: number;
  overdueTasks: number;
};

export async function getInternalDashboardStats(): Promise<InternalDashboardStats> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [activeCustomers, activeContracts, openTickets, overdueTasks] =
    await Promise.all([
      // "Đang hoạt động" = chưa chấm dứt quan hệ (loại 'ended' và soft-deleted)
      supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .in("status", ["new", "active", "paused"])
        .is("deleted_at", null),
      // "Đang chạy" = đã ký và còn hiệu lực (loại draft/completed/cancelled)
      supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .in("status", ["signed", "active"])
        .is("deleted_at", null),
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .in("status", ["new", "in_progress", "awaiting_customer"])
        .is("deleted_at", null),
      supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .lt("due_at", nowIso)
        .not("status", "in", "(done,cancelled)")
        .is("deleted_at", null),
    ]);

  return {
    activeCustomers: activeCustomers.count ?? 0,
    activeContracts: activeContracts.count ?? 0,
    openTickets: openTickets.count ?? 0,
    overdueTasks: overdueTasks.count ?? 0,
  };
}
