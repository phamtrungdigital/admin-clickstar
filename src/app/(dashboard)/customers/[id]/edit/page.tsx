import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomerById, listInternalStaff } from "@/lib/queries/customers";

export const metadata = { title: "Sửa khách hàng | Portal.Clickstar.vn" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, staff] = await Promise.all([
    getCustomerById(id).catch(() => null),
    listInternalStaff().catch(() => []),
  ]);

  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`Chỉnh sửa: ${customer.name}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Khách hàng", href: "/customers" },
          { label: customer.name, href: `/customers/${customer.id}` },
          { label: "Chỉnh sửa" },
        ]}
      />
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        defaultValues={{
          name: customer.name,
          code: customer.code ?? "",
          status: customer.status,
          industry: customer.industry ?? "",
          website: customer.website ?? "",
          representative: customer.representative ?? "",
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          address: customer.address ?? "",
          tax_code: customer.tax_code ?? "",
          primary_account_manager_id:
            customer.primary_account_manager?.id ?? null,
        }}
        staff={staff}
      />
    </div>
  );
}
