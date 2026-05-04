import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * PageHeader 2026-05-04 v2: refine theo feedback "viền không sang trọng".
 *
 * Đổi thứ tự hiển thị: Breadcrumb → Title → Description (chuẩn
 * Linear/Vercel/Claude). Breadcrumb dùng text-xs subtle ở trên cùng để
 * orient mà không "ăn visual weight" của title. Bỏ mb-6 vì parent đã
 * dùng space-y-6 — tránh spacing đôi.
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {breadcrumb.map((c, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <ChevronRight
                        className="h-3 w-3 text-slate-300"
                        aria-hidden
                      />
                    )}
                    {c.href && !isLast ? (
                      <Link
                        href={c.href}
                        className="transition-colors hover:text-slate-900"
                      >
                        {c.label}
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          isLast ? "font-medium text-slate-700" : "text-slate-500",
                        )}
                      >
                        {c.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
