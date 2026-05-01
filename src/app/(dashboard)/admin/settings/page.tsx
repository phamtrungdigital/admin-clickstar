import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSystemSettings } from "@/lib/queries/settings";

export const metadata = { title: "Cài đặt hệ thống | Portal.Clickstar.vn" };

export default async function SettingsPage() {
  const [{ profile }, settings] = await Promise.all([
    getCurrentUser(),
    getSystemSettings(),
  ]);

  const canEdit =
    profile?.audience === "internal" &&
    profile.internal_role === "super_admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Cài đặt hệ thống"
        description="Cấu hình tổ chức, mặc định kinh doanh và kênh thông báo. Mọi thay đổi được ghi vào nhật ký."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Cài đặt hệ thống" },
        ]}
      />
      <SettingsForm initial={settings} canEdit={canEdit} />
    </div>
  );
}
