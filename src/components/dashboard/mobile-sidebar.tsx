"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Audience, InternalRole } from "@/lib/database.types";
import { SidebarContent } from "./sidebar";

/**
 * Shared open/close state for the mobile sidebar. The trigger button lives
 * inside the sticky <header> while the drawer panel lives at the layout
 * root — without a shared store they couldn't talk to each other, and
 * rendering the drawer inside the header caused stacking-context issues
 * (backdrop got clipped to the header's z-30 context, leaving the main
 * page content peeking through on the right of the drawer).
 */
const MobileSidebarContext = createContext<{
  open: boolean;
  setOpen: (next: boolean) => void;
} | null>(null);

export function MobileSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

function useMobileSidebar() {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) {
    throw new Error(
      "useMobileSidebar must be used inside <MobileSidebarProvider>",
    );
  }
  return ctx;
}

/** Hamburger button — placed inside the header on mobile. */
export function MobileSidebarTrigger() {
  const { open, setOpen } = useMobileSidebar();
  return (
    <button
      type="button"
      aria-label="Mở menu"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

/**
 * Backdrop + slide-in drawer panel. Rendered at the layout root so its
 * `fixed` positioning escapes any sticky/transformed parent stacking
 * context. Auto-closes on route change.
 */
export function MobileSidebarDrawer({
  audience,
  internalRole,
}: {
  audience: Audience;
  internalRole: InternalRole | null;
}) {
  const { open, setOpen } = useMobileSidebar();
  const pathname = usePathname();
  // Render-phase pattern: when path changes, force-close (no useEffect).
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/50 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
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
