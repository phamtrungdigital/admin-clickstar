import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Inbox, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StaffFeedbackItem } from "@/lib/queries/staff-feedback";

const ROLE_TONE: Record<
  StaffFeedbackItem["author"]["role_label"],
  string
> = {
  Admin: "bg-rose-50 text-rose-700 ring-rose-200",
  Manager: "bg-violet-50 text-violet-700 ring-violet-200",
  "Khách hàng": "bg-amber-50 text-amber-700 ring-amber-200",
};

const SOURCE_LABEL: Record<StaffFeedbackItem["source"], string> = {
  milestone: "Công việc",
  task: "Đầu việc",
};

/**
 * Widget Dashboard cho Staff: list comment "đáng chú ý" từ admin / manager
 * / khách hàng trong các milestone + task của họ trong 7 ngày qua. Mục
 * đích: nhân viên không bỏ sót feedback cần follow gấp.
 *
 * Server component — render từ data prop, không fetch trong component.
 */
export function StaffFeedbackPanel({
  items,
}: {
  items: StaffFeedbackItem[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Inbox className="h-4 w-4 text-blue-600" />
            Phản hồi mới từ Admin & Khách
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Comment 7 ngày gần nhất trên công việc + đầu việc bạn phụ trách —
            cần follow để không bỏ sót.
          </p>
        </div>
        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          {items.length} phản hồi
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-slate-300" />
          <h4 className="mt-3 text-sm font-semibold text-slate-900">
            Chưa có phản hồi mới
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Khi admin/PM hoặc khách bình luận trên công việc / đầu việc của
            bạn, nội dung sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={`${item.source}-${item.comment_id}`}>
              <Link
                href={item.context.href}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-slate-50/60"
              >
                <Avatar
                  name={item.author.full_name}
                  url={item.author.avatar_url}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {item.author.full_name}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                        ROLE_TONE[item.author.role_label],
                      )}
                    >
                      {item.author.role_label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                        locale: vi,
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">
                    {item.body}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    <span className="font-medium text-slate-600">
                      {SOURCE_LABEL[item.source]}
                    </span>
                    {" · "}
                    {item.context.item_title}
                    {" · "}
                    <span className="text-slate-400">
                      {item.context.project_name}
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Avatar({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) {
  const initials = name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(-2)
    .join("")
    .toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
      {initials || "?"}
    </div>
  );
}
