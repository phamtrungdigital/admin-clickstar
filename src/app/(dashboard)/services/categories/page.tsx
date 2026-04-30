import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { listServices } from "@/lib/queries/services";
import { SERVICE_CATEGORY_SUGGESTIONS } from "@/lib/validation/services";

export const metadata = { title: "Danh mục dịch vụ | Portal.Clickstar.vn" };

type CategorySummary = {
  name: string;
  total: number;
  active: number;
};

export default async function ServiceCategoriesPage() {
  let summaries: CategorySummary[] = [];
  let loadError: string | null = null;
  try {
    const result = await listServices({ pageSize: 1000 });
    const map = new Map<string, CategorySummary>();
    for (const row of result.rows) {
      const name = row.category ?? "Chưa phân loại";
      const entry = map.get(name) ?? { name, total: 0, active: 0 };
      entry.total += 1;
      if (row.is_active) entry.active += 1;
      map.set(name, entry);
    }
    summaries = Array.from(map.values()).sort((a, b) => b.total - a.total);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Danh mục dịch vụ"
        description="Tổng hợp số lượng dịch vụ theo từng danh mục."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Dịch vụ", href: "/services" },
          { label: "Danh mục" },
        ]}
      />

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {summaries.length === 0 && !loadError ? (
        <EmptyHint />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((cat) => (
            <Link
              key={cat.name}
              href={`/services?category=${encodeURIComponent(cat.name)}`}
              className="group rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                    {cat.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {cat.active}/{cat.total} đang cung cấp
                  </p>
                </div>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FolderOpen className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-slate-900">{cat.total}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">Danh mục gợi ý</h3>
        <p className="mt-1 text-xs text-slate-500">
          Dùng làm chuẩn khi đặt tên danh mục cho dịch vụ mới (có thể tự đặt khác).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SERVICE_CATEGORY_SUGGESTIONS.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
      <h3 className="mt-3 text-base font-semibold text-slate-900">Chưa có danh mục</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Khi tạo dịch vụ và chọn danh mục, các nhóm sẽ hiển thị tại đây.
      </p>
    </div>
  );
}
