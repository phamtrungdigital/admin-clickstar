"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Audience, InternalRole } from "@/lib/database.types";
import { SidebarContent } from "./sidebar";

/**
 * Mobile-only navigation: hamburger button + slide-in drawer.
 * Auto-closes on route change so the user lands on the new page
 * without manually dismissing the drawer.
 */
export function MobileSidebar({
  audience,
  internalRole,
}: {
  audience: Audience;
  internalRole: InternalRole | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Track route changes via a render-phase pattern (avoid useEffect to keep
  // React Compiler happy); when the path changes, force-close the drawer.
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Mở menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/50 transition-opacity lg:hidden",
          open
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Điều hướng"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent
          audience={audience}
          internalRole={internalRole}
          onNavigate={() => setOpen(false)}
        />
      </aside>
    </>
  );
}
