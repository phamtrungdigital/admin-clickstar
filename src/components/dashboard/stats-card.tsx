import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";

const TONE_STYLES: Record<StatTone, { wrap: string; icon: string }> = {
  blue: { wrap: "bg-blue-50 text-blue-600", icon: "" },
  emerald: { wrap: "bg-emerald-50 text-emerald-600", icon: "" },
  violet: { wrap: "bg-violet-50 text-violet-600", icon: "" },
  amber: { wrap: "bg-amber-50 text-amber-600", icon: "" },
  rose: { wrap: "bg-rose-50 text-rose-600", icon: "" },
  slate: { wrap: "bg-slate-100 text-slate-600", icon: "" },
};

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
  const tones = TONE_STYLES[tone];
  const isPositive = delta !== undefined && delta >= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", tones.wrap)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {delta !== undefined && (
            <p
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                isPositive ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(delta).toFixed(1)}% <span className="text-slate-400 font-normal">{deltaLabel}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
