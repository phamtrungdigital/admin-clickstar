import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  // Perf: layout chạy mỗi page nav. Trước đây gọi 3 query sequential
  // (auth.getUser → profiles → notifications.count) = 3 round-trips. Giờ
  // gộp: 1 round-trip auth.getUser, sau đó parallel profile + count
  // bằng Promise.all → còn 2 round-trips. Tiết kiệm ~50-100ms mỗi nav.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userId = user.id;
  const email = user.email ?? "";

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);

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
            audience={audience}
            unreadNotifications={unreadCount ?? 0}
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
