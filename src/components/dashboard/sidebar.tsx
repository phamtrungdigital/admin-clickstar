"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Headphones } from "lucide-react";

import { cn } from "@/lib/utils";
import { ClickstarLogo } from "@/components/clickstar-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { NavItem } from "./nav-config";

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 py-5">
        <ClickstarLogo variant="light" />
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => (
            <SidebarItem key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-slate-200 px-3 py-4">
        <SupportCard />
      </div>
    </aside>
  );
}

function SidebarItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = useMemo(() => isItemActive(item, pathname), [item, pathname]);
  const hasChildren = !!item.children?.length;
  const childIsActive = useMemo(
    () =>
      hasChildren && item.children!.some((c) => isItemActive(c, pathname)),
    [hasChildren, item.children, pathname],
  );

  // Auto-open the section when one of its children is active
  const [open, setOpen] = useState(childIsActive);
  useEffect(() => {
    if (childIsActive) setOpen(true);
  }, [childIsActive]);

  if (!hasChildren) {
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  const Icon = item.icon;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          childIsActive
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 flex-shrink-0 text-slate-400 transition-transform",
            open && "rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 pl-3 py-1">
          {item.children!.map((child) => {
            const active = isItemActive(child, pathname);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "font-medium text-blue-700"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    active ? "bg-blue-600" : "bg-slate-300",
                  )}
                />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SupportCard() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <p className="text-xs font-semibold text-slate-700">Clickstar Support</p>
      </div>
      <p className="text-[11px] text-slate-500">
        Đội hỗ trợ trực tuyến — phản hồi trong vòng 15 phút.
      </p>
      <button
        type="button"
        className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
      >
        <Headphones className="h-3.5 w-3.5" />
        Gửi yêu cầu hỗ trợ
      </button>
    </div>
  );
}

function isItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  // Don't match /dashboard for / or vice versa
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(item.href + "/");
}
