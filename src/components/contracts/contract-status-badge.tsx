import { cn } from "@/lib/utils";
import { CONTRACT_STATUS_OPTIONS } from "@/lib/validation/contracts";
import type { ContractStatus } from "@/lib/database.types";

const TONE_CLASS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function ContractStatusBadge({
  status,
  className,
}: {
  status: ContractStatus;
  className?: string;
}) {
  const cfg = CONTRACT_STATUS_OPTIONS.find((o) => o.value === status);
  if (!cfg) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASS[cfg.tone],
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
