import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertCircle } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState as EmptyStateUI } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export const metadata = { title: "Lỗi hệ thống | Portal.Clickstar.vn" };

type ErrorRow = {
  id: string;
  category: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown>;
  user_id: string | null;
  request_path: string | null;
  created_at: string;
};

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { profile } = await getCurrentUser();
  // Gate: super_admin / admin only. Manager/staff không cần thấy noise.
  if (
    profile?.audience !== "internal" ||
    !["super_admin", "admin"].includes(profile.internal_role ?? "")
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const category = params.category;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("error_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (category) query = query.eq("category", category);
  const { data, count } = await query.range(from, to);
  const errors = (data as ErrorRow[] | null) ?? [];
  const total = count ?? 0;

  // Top categories trong 7 ngày gần đây — để admin scan nhanh recurring issues
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRows } = await supabase
    .from("error_log")
    .select("category")
    .gte("created_at", since);
  const categoryCounts = new Map<string, number>();
  for (const r of (recentRows as { category: string }[] | null) ?? []) {
    categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1);
  }
  const topCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Lỗi hệ thống"
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị", href: "/admin/users" },
          { label: "Lỗi hệ thống" },
        ]}
      />

      {topCategories.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            Top categories (7 ngày)
          </h3>
          <div className="flex flex-wrap gap-2">
            {topCategories.map(([cat, count]) => {
              const active = cat === category;
              const tone =
                count >= 20
                  ? "bg-rose-50 text-rose-800 ring-rose-200"
                  : count >= 5
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-slate-50 text-slate-700 ring-slate-200";
              return (
                <a
                  key={cat}
                  href={
                    active ? "/admin/errors" : `/admin/errors?category=${cat}`
                  }
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset hover:opacity-80 ${tone} ${active ? "ring-2" : ""}`}
                >
                  <code className="font-mono">{cat}</code>
                  <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px]">
                    {count}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {errors.length === 0 ? (
        <EmptyStateUI
          icon={AlertCircle}
          title="Không có lỗi nào"
          description={
            category
              ? `Chưa có lỗi nào trong category "${category}".`
              : "Chưa có lỗi hệ thống nào được ghi nhận. Tốt!"
          }
        />
      ) : (
        <div className="space-y-2">
          {category && (
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>
                Đang lọc theo <code className="font-mono">{category}</code> —{" "}
                {total} dòng
              </span>
              <a href="/admin/errors" className="text-blue-700 hover:underline">
                Bỏ lọc
              </a>
            </div>
          )}
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {errors.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <code className="rounded bg-rose-50 px-1.5 py-0.5 font-mono text-xs text-rose-800 ring-1 ring-inset ring-rose-200">
                    {e.category}
                  </code>
                  <time
                    className="text-xs text-slate-400"
                    title={format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss")}
                  >
                    {formatDistanceToNow(new Date(e.created_at), {
                      addSuffix: true,
                      locale: vi,
                    })}
                  </time>
                </div>
                <p className="mt-1 break-words text-sm text-slate-800">
                  {e.message}
                </p>
                {(e.user_id || e.request_path) && (
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    {e.user_id && (
                      <span>
                        user:{" "}
                        <code className="font-mono">{e.user_id.slice(0, 8)}…</code>
                      </span>
                    )}
                    {e.request_path && (
                      <span>
                        path: <code className="font-mono">{e.request_path}</code>
                      </span>
                    )}
                  </div>
                )}
                {Object.keys(e.context).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-700">
                      Context
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
                      {JSON.stringify(e.context, null, 2)}
                    </pre>
                  </details>
                )}
                {e.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-700">
                      Stack trace
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
                      {e.stack}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {total > pageSize && (
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>
                Trang {page} / {Math.ceil(total / pageSize)} ({total} lỗi)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`/admin/errors?page=${page - 1}${category ? `&category=${category}` : ""}`}
                    className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
                  >
                    ← Trước
                  </a>
                )}
                {page * pageSize < total && (
                  <a
                    href={`/admin/errors?page=${page + 1}${category ? `&category=${category}` : ""}`}
                    className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
                  >
                    Sau →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
