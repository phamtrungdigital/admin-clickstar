import { PageHeader } from "@/components/dashboard/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import {
  listActiveServicesGrouped,
  listInternalStaff,
} from "@/lib/queries/customers";
import { requireInternalPage, canManageCustomers } from "@/lib/auth/guards";

export const metadata = { title: "Thêm khách hàng | Portal.Clickstar.vn" };

export default async function NewCustomerPage() {
  const profile = await requireInternalPage();
  const [staff, services] = await Promise.all([
    listInternalStaff().catch(() => []),
    listActiveServicesGrouped().catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Thêm khách hàng"
        description="Thêm một doanh nghiệp mới vào hệ thống và phân công người phụ trách."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Khách hàng", href: "/customers" },
          { label: "Thêm khách hàng" },
        ]}
      />
      <CustomerForm
        mode="create"
        staff={staff}
        services={services}
        currentUserId={profile.id}
        canChooseManager={canManageCustomers(profile)}
      />
    </div>
  );
}
