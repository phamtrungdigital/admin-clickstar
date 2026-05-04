"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-3 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

// Tabs styling 2026-05-04 v2: refine theo feedback "viền lồng viền không
// sang trọng" — bỏ ring outer của container, active tab dùng hairline
// shadow gộp thay vì ring inset. Compact hơn: h-9 + padding 3px + pill
// rounded-md. Font 13px medium, inactive text-slate-600 cho contrast tốt.
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-[10px] p-[3px] text-slate-600 group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-slate-100/80",
        line: "gap-1 bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Layout — pill gọn px-3, rounded-md để tỉ lệ với container 10px
        "relative inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-[13px] font-medium transition-[color,background-color,box-shadow] duration-150",
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        // Default state — slate-600 cho contrast premium, hover slate-900
        "text-slate-600 hover:text-slate-900",
        // Active state — bg-white + hairline shadow gộp (1px ring + drop nhẹ)
        // thay vì ring-1 + shadow-sm riêng → cảm giác 1 lớp duy nhất, sang
        "data-active:bg-white data-active:text-slate-900",
        "data-active:shadow-[0_0_0_1px_rgb(15_23_42_/_0.05),0_1px_2px_-1px_rgb(15_23_42_/_0.08),0_2px_4px_-2px_rgb(15_23_42_/_0.04)]",
        // Variant line: không pill, dùng underline xanh
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:shadow-none",
        // Underline indicator cho variant line
        "after:absolute after:bg-blue-600 after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-7px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        // Focus ring + disabled
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        // Icon spacing
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
