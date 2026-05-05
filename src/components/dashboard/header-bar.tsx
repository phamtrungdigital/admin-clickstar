"use client";

import { useSyncExternalStore } from "react";
import { HelpCircle, Search } from "lucide-react";

import { ClickstarLogo } from "@/components/clickstar-logo";
import { Separator } from "@/components/ui/separator";
import { MobileSidebarTrigger } from "./mobile-sidebar";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import type { Audience } from "@/lib/database.types";

const subscribeNoop = () => () => {};
const getShortcutLabelClient = () =>
  /Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? "⌘ K" : "Ctrl K";
const getShortcutLabelServer = () => "Ctrl K";

export function HeaderBar({
  fullName,
  email,
  avatarUrl,
  role,
  audience,
  currentUserId,
  unreadNotifications = 0,
}: {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  audience: Audience;
  currentUserId: string;
  unreadNotifications?: number;
}) {
  const isCustomer = audience === "customer";
  const searchPlaceholder = isCustomer
    ? "Tìm kiếm ticket, dịch vụ, nội dung..."
    : "Tìm kiếm khách hàng, hợp đồng, ticket...";
  const shortcutLabel = useSyncExternalStore(
    subscribeNoop,
    getShortcutLabelClient,
    getShortcutLabelServer,
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur sm:gap-3 sm:px-6">
      <MobileSidebarTrigger />

      {/* Compact logo for mobile (sidebar is hidden, but we still want branding) */}
      <div className="flex items-center lg:hidden">
        <ClickstarLogo variant="dark" size="sm" showTagline={false} />
      </div>

      {/* Search: hidden on mobile to free space; show on tablet+ */}
      <div className="relative hidden flex-1 sm:block sm:max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-16 text-sm placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {shortcutLabel}
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Quick search icon on mobile (placeholder — opens search later) */}
        <button
          type="button"
          aria-label="Tìm kiếm"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:hidden"
        >
          <Search className="h-5 w-5" />
        </button>

        <NotificationBell
          initialCount={unreadNotifications}
          currentUserId={currentUserId}
        />
        <button
          type="button"
          aria-label="Trợ giúp"
          className="hidden h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:inline-flex"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:mx-2 sm:block" />

        <UserMenu
          fullName={fullName}
          email={email}
          avatarUrl={avatarUrl}
          role={role}
        />
      </div>
    </header>
  );
}
