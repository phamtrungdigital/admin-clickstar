import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";

const TONE_STYLES: Record<StatTone, string> = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

/**
 * StatsCard 2026-05-04 v2: refine — icon nhỏ ở góc phải (h-9, rounded-lg)
 * thay vì block to bên trái. Số dùng tabular-nums + text-[26px] semibold
 * cho cảm giác premium. Border slate-200 → slate-200/70 (nhẹ hơn).
 * Không có hover (card thông tin tĩnh).
 */
export function StatsCard({
  label,
  value,
  delta,
  deltaLabel = "so với tháng trước",
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  const isPositive = delta !== undefined && delta >= 0;

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
          <p className="text-[26px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
            TONE_STYLES[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {delta !== undefined && (
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-xs font-medium",
            isPositive ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {isPositive ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {Math.abs(delta).toFixed(1)}%
          <span className="font-normal text-slate-400">{deltaLabel}</span>
        </p>
      )}
    </div>
  );
}
