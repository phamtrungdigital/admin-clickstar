import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { ServiceForm } from "@/components/services/service-form";
import { getServiceById } from "@/lib/queries/services";

export const metadata = { title: "Sửa dịch vụ | Portal.Clickstar.vn" };

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getServiceById(id).catch(() => null);
  if (!service) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Chỉnh sửa: ${service.name}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Dịch vụ", href: "/services" },
          { label: service.name, href: `/services/${service.id}` },
          { label: "Chỉnh sửa" },
        ]}
      />
      <ServiceForm
        mode="edit"
        serviceId={service.id}
        defaultValues={{
          name: service.name,
          code: service.code ?? "",
          category: service.category ?? "",
          description: service.description ?? "",
          default_price: Number(service.default_price),
          billing_cycle: service.billing_cycle ?? "",
          is_active: service.is_active,
        }}
      />
    </div>
  );
}
