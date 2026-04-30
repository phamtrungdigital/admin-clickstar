import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileSignature,
  Mail,
  MessageSquare,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getInternalDashboardStats,
  type InternalDashboardStats,
} from "@/lib/queries/dashboard";

export const metadata: Metadata = {
  title: "Tổng quan | Portal.Clickstar.vn",
};

export default async function DashboardPage() {
  const { profile } = await getCurrentUser();
  const isInternal = profile?.audience !== "customer";
  const greeting = profile?.full_name?.split(" ").slice(-1)[0] || "bạn";

  const stats = isInternal
    ? await getInternalDashboardStats().catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Xin chào, ${greeting} 👋`}
        description={
          isInternal
            ? "Tổng quan vận hành dịch vụ và chăm sóc khách hàng của Clickstar."
            : "Theo dõi tiến độ dịch vụ và báo cáo của doanh nghiệp."
        }
        breadcrumb={[{ label: "Trang chủ" }, { label: "Tổng quan" }]}
      />

      {isInternal ? <InternalSummary stats={stats} /> : <CustomerSummary />}

      <div className="grid gap-6 lg:grid-cols-2">
        <PlaceholderPanel
          title="Hợp đồng cần xử lý"
          description="Hợp đồng đến hạn, sắp ký, đang chờ duyệt sẽ hiển thị tại đây."
        />
        <PlaceholderPanel
          title="Ticket gần đây"
          description="Yêu cầu hỗ trợ mới và chưa xử lý sẽ hiển thị tại đây."
        />
      </div>
    </div>
  );
}

function InternalSummary({ stats }: { stats: InternalDashboardStats | null }) {
  const fmt = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("vi-VN");
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard
        label="Khách hàng đang hoạt động"
        value={fmt(stats?.activeCustomers)}
        icon={Building2}
        tone="blue"
      />
      <StatsCard
        label="Hợp đồng đang chạy"
        value={fmt(stats?.activeContracts)}
        icon={FileSignature}
        tone="violet"
      />
      <StatsCard
        label="Ticket đang mở"
        value={fmt(stats?.openTickets)}
        icon={MessageSquare}
        tone="amber"
      />
      <StatsCard
        label="Công việc trễ hạn"
        value={fmt(stats?.overdueTasks)}
        icon={CircleAlert}
        tone="rose"
      />
    </div>
  );
}

function CustomerSummary() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard
        label="Dịch vụ đang triển khai"
        value="—"
        icon={Users}
        tone="blue"
      />
      <StatsCard
        label="Hạng mục hoàn thành"
        value="—"
        icon={CheckCircle2}
        tone="emerald"
      />
      <StatsCard label="Ticket đang mở" value="—" icon={MessageSquare} tone="amber" />
      <StatsCard
        label="Báo cáo gần nhất"
        value="—"
        icon={Mail}
        tone="violet"
      />
    </div>
  );
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-400">
        Chưa có dữ liệu — sẽ hiển thị khi Phase C hoàn tất.
      </div>
    </div>
  );
}
