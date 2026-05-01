import { PageHeader } from "@/components/dashboard/page-header";
import { TicketForm } from "@/components/tickets/ticket-form";
import { listActiveCompaniesForSelect } from "@/lib/queries/contracts";
import { listInternalStaff } from "@/lib/queries/customers";

export const metadata = { title: "Thêm ticket | Portal.Clickstar.vn" };

export default async function NewTicketPage() {
  const [companies, staff] = await Promise.all([
    listActiveCompaniesForSelect().catch(() => []),
    listInternalStaff().catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Thêm ticket"
        description="Ghi nhận yêu cầu hỗ trợ mới từ khách hàng."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Ticket", href: "/tickets" },
          { label: "Thêm ticket" },
        ]}
      />
      <TicketForm mode="create" companies={companies} staff={staff} />
    </div>
  );
}
