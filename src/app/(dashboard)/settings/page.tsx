import { redirect } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Cài đặt cá nhân | Portal.Clickstar.vn" };

export default async function SettingsPage() {
  const { profile, email } = await getCurrentUser();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Cài đặt cá nhân"
        description="Quản lý hồ sơ + mật khẩu của bạn."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Cài đặt" },
        ]}
      />
      <AccountSettingsForm
        defaults={{
          full_name: profile.full_name ?? "",
          phone: profile.phone ?? "",
          avatar_url: profile.avatar_url ?? "",
        }}
        email={email}
      />
    </div>
  );
}
