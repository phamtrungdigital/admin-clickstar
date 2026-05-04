import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — pattern duy nhất dùng khắp site cho list/tab rỗng.
 *
 * Trước đây mỗi page tự render `<div className="rounded-xl border-dashed
 * border-slate-300 bg-white p-12 text-center">` lặp lại 20+ chỗ với spacing
 * + icon size không đồng bộ. Component này gom 1 chỗ — sau này anh muốn
 * tweak (ví dụ thêm illustration, đổi padding) chỉ sửa 1 file.
 *
 * Ví dụ:
 *   <EmptyState
 *     icon={Building2}
 *     title="Chưa có khách hàng"
 *     description={<>Bấm <strong>Thêm khách hàng</strong> để tạo bản ghi đầu tiên.</>}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** "sm" cho empty trong tab/section nhỏ, "md" cho list page (default). */
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-300 bg-white text-center",
        isSm ? "p-8" : "p-12",
        className,
      )}
    >
      <span
        className={cn(
          "mx-auto flex items-center justify-center rounded-full bg-slate-100",
          isSm ? "h-10 w-10" : "h-12 w-12",
        )}
      >
        <Icon
          className={cn(
            "text-slate-400",
            isSm ? "h-5 w-5" : "h-6 w-6",
          )}
        />
      </span>
      <h3
        className={cn(
          "mt-4 font-semibold text-slate-900",
          isSm ? "text-sm" : "text-base",
        )}
      >
        {title}
      </h3>
      {description && (
        <div className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          {description}
        </div>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
