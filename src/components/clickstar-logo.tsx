import { cn } from "@/lib/utils";
import { MousePointer2 } from "lucide-react";

export function ClickstarLogo({
  variant = "dark",
  showTagline = true,
  className,
}: {
  variant?: "light" | "dark";
  showTagline?: boolean;
  className?: string;
}) {
  const isLight = variant === "light";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "text-3xl font-extrabold tracking-tight",
            isLight ? "text-white" : "text-blue-600",
          )}
        >
          CLICK
        </span>
        <MousePointer2
          className={cn(
            "h-6 w-6 -rotate-12 fill-current",
            isLight ? "text-white" : "text-blue-600",
          )}
        />
        <span
          className={cn(
            "text-3xl font-extrabold tracking-tight",
            isLight ? "text-white" : "text-blue-600",
          )}
        >
          STAR
        </span>
      </div>
      {showTagline && (
        <p
          className={cn(
            "text-xs font-medium",
            isLight ? "text-blue-100/90" : "text-slate-500",
          )}
        >
          Giải pháp Digital & Automation toàn diện
        </p>
      )}
    </div>
  );
}
