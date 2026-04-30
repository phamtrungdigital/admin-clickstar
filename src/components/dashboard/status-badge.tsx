import { cn } from "@/lib/utils";
import type { CompanyStatus } from "@/lib/database.types";

const COMPANY_STATUS_STYLES: Record<
  CompanyStatus,
  { label: string; className: string }
> = {
  new: {
    label: "Mới",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  active: {
    label: "Đang triển khai",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  paused: {
    label: "Tạm dừng",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  ended: {
    label: "Kết thúc",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  },
};

export function CompanyStatusBadge({
  status,
  className,
}: {
  status: CompanyStatus;
  className?: string;
}) {
  const cfg = COMPANY_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
