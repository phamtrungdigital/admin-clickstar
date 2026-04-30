import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  total,
  page,
  pageSize,
  basePath,
  searchParams,
}: {
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Hiển thị {total === 0 ? 0 : 1} – {total} trên {total}
        </span>
      </div>
    );
  }

  const linkFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages = compactPageList(page, totalPages);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Hiển thị {from} – {to} trên {total}
      </p>
      <nav className="flex items-center gap-1">
        <PageBtn
          href={page > 1 ? linkFor(page - 1) : undefined}
          aria="Trang trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageBtn>
        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={`gap-${idx}`} className="px-2 text-slate-400">
              ...
            </span>
          ) : (
            <PageBtn
              key={p}
              href={linkFor(p)}
              active={p === page}
              aria={`Trang ${p}`}
            >
              {p}
            </PageBtn>
          ),
        )}
        <PageBtn
          href={page < totalPages ? linkFor(page + 1) : undefined}
          aria="Trang sau"
        >
          <ChevronRight className="h-4 w-4" />
        </PageBtn>
      </nav>
    </div>
  );
}

function PageBtn({
  href,
  active,
  aria,
  children,
}: {
  href?: string;
  active?: boolean;
  aria: string;
  children: React.ReactNode;
}) {
  const className = cn(
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors",
    active
      ? "border-blue-600 bg-blue-600 text-white"
      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
    !href && "pointer-events-none opacity-50",
  );
  if (!href) {
    return (
      <span className={className} aria-disabled aria-label={aria}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-label={aria}>
      {children}
    </Link>
  );
}

function compactPageList(current: number, total: number): Array<number | "..."> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "..."> = [1];
  if (current > 3) out.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) out.push(i);
  if (current < total - 2) out.push("...");
  out.push(total);
  return out;
}
