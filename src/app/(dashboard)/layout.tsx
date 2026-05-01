import { getCurrentUser } from "@/lib/auth/current-user";
import { Sidebar } from "@/components/dashboard/sidebar";
import { HeaderBar } from "@/components/dashboard/header-bar";
import {
  MobileSidebarDrawer,
  MobileSidebarProvider,
} from "@/components/dashboard/mobile-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email, profile } = await getCurrentUser();

  const audience = profile?.audience ?? "internal";
  const internalRole = profile?.internal_role ?? null;
  const role = audience === "customer" ? "viewer" : internalRole ?? "staff";

  return (
    <MobileSidebarProvider>
      <div className="flex h-svh w-full bg-slate-50/50">
        <Sidebar audience={audience} internalRole={internalRole} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <HeaderBar
            fullName={profile?.full_name || email}
            email={email}
            avatarUrl={profile?.avatar_url ?? null}
            role={role}
          />
          <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {children}
          </main>
        </div>
      </div>
      <MobileSidebarDrawer audience={audience} internalRole={internalRole} />
    </MobileSidebarProvider>
  );
}
