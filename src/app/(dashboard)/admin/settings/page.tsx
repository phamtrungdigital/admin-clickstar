import { PageHeader } from "@/components/dashboard/page-header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { SettingsForm } from "@/components/admin/settings-form";
import { AiIntegrationsPanel } from "@/components/admin/ai-integrations-panel";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSystemSettings } from "@/lib/queries/settings";
import { listAiIntegrations } from "@/lib/queries/ai-integrations";

export const metadata = { title: "Cài đặt hệ thống | Portal.Clickstar.vn" };

export default async function SettingsPage() {
  const [{ profile }, settings, aiIntegrations] = await Promise.all([
    getCurrentUser(),
    getSystemSettings(),
    listAiIntegrations().catch(() => []),
  ]);

  const canEdit =
    profile?.audience === "internal" &&
    profile.internal_role === "super_admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Cài đặt hệ thống"
        description="Cấu hình tổ chức, kênh thông báo và tích hợp AI. Mọi thay đổi được ghi vào nhật ký."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Cài đặt hệ thống" },
        ]}
      />
      <Tabs defaultValue="general">
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="general">Tổ chức & Thông báo</TabsTrigger>
          <TabsTrigger value="ai">
            Tích hợp AI ({aiIntegrations.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <SettingsForm initial={settings} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <AiIntegrationsPanel integrations={aiIntegrations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
