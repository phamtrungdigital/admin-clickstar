import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Bell, BellRing } from "lucide-react";

import { EmptyState as EmptyStateUI } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Thông báo | Portal.Clickstar.vn" };

export default async function NotificationsPage() {
  const { id: userId } = await getCurrentUser();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("notifications")
    .select("id, title, body, link_url, entity_type, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const unread = (rows ?? []).filter((r) => !r.read_at).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Thông báo"
        description={
          unread > 0
            ? `Bạn có ${unread} thông báo chưa đọc.`
            : "Tất cả thông báo của bạn — yêu cầu hỗ trợ, cập nhật trạng thái và tin tức từ Clickstar."
        }
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Thông báo" },
        ]}
      />

      {!rows || rows.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {rows.map((row) => (
            <NotificationRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({
  row,
}: {
  row: {
    id: string;
    title: string;
    body: string | null;
    link_url: string | null;
    entity_type: string | null;
    read_at: string | null;
    created_at: string;
  };
}) {
  const unread = !row.read_at;
  const inner = (
    <div className="flex items-start gap-3 px-4 py-3">
      <div
        className={
          unread
            ? "mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"
            : "mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400"
        }
      >
        {unread ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={
              unread
                ? "truncate text-sm font-semibold text-slate-900"
                : "truncate text-sm text-slate-700"
            }
          >
            {row.title}
          </p>
          <time
            className="flex-shrink-0 text-xs text-slate-400"
            title={format(new Date(row.created_at), "dd/MM/yyyy HH:mm")}
          >
            {formatDistanceToNow(new Date(row.created_at), {
              addSuffix: true,
              locale: vi,
            })}
          </time>
        </div>
        {row.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{row.body}</p>
        )}
      </div>
    </div>
  );

  if (row.link_url) {
    return (
      <li className={unread ? "bg-blue-50/40" : ""}>
        <Link href={row.link_url} className="block hover:bg-slate-50">
          {inner}
        </Link>
      </li>
    );
  }
  return <li className={unread ? "bg-blue-50/40" : ""}>{inner}</li>;
}

function EmptyState() {
  return (
    <EmptyStateUI
      icon={Bell}
      title="Chưa có thông báo"
      description="Khi có yêu cầu hỗ trợ mới hoặc cập nhật từ Clickstar, thông báo sẽ hiển thị tại đây."
    />
  );
}
