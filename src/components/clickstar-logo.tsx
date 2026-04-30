import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export function ClickstarLogo({
  variant = "dark",
  showTagline = true,
  size = "md",
  className,
}: {
  variant?: "light" | "dark";
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const isLight = variant === "light";
  const sizes = {
    sm: { text: "text-2xl", icon: "h-5 w-5", tagline: "text-[10px]" },
    md: { text: "text-3xl", icon: "h-6 w-6", tagline: "text-xs" },
    lg: { text: "text-4xl", icon: "h-8 w-8", tagline: "text-sm" },
  }[size];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "font-extrabold tracking-tight",
            sizes.text,
            isLight ? "text-white" : "text-blue-600",
          )}
        >
          CLICK
        </span>
        <Star
          className={cn(
            "fill-current",
            sizes.icon,
            isLight ? "text-white" : "text-blue-600",
          )}
          strokeWidth={1.5}
        />
        <span
          className={cn(
            "font-extrabold tracking-tight",
            sizes.text,
            isLight ? "text-white" : "text-blue-600",
          )}
        >
          STAR
        </span>
      </div>
      {showTagline && (
        <p
          className={cn(
            "font-medium",
            sizes.tagline,
            isLight ? "text-blue-100/85" : "text-slate-500",
          )}
        >
          Giải pháp Digital & Automation toàn diện
        </p>
      )}
    </div>
  );
}
