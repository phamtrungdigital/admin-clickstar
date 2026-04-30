import { cn } from "@/lib/utils";

export function ServiceStatusBadge({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-amber-200",
        className,
      )}
    >
      {isActive ? "Đang cung cấp" : "Tạm ngưng"}
    </span>
  );
}

export function formatVnd(amount: number): string {
  if (!amount) return "—";
  return amount.toLocaleString("vi-VN") + " ₫";
}
