import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { TicketForm } from "@/components/tickets/ticket-form";
import { getTicketById } from "@/lib/queries/tickets";
import { listActiveCompaniesForSelect } from "@/lib/queries/contracts";
import { listInternalStaff } from "@/lib/queries/customers";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Sửa ticket | Portal.Clickstar.vn" };

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Edit ticket form chứa fields nhân viên-only (assignee, status, mã,
  // company). Khách hàng chỉ tạo + comment, không edit form nội bộ.
  await requireInternalPage();

  const { id } = await params;
  const [ticket, companies, staff] = await Promise.all([
    getTicketById(id).catch(() => null),
    listActiveCompaniesForSelect().catch(() => []),
    listInternalStaff().catch(() => []),
  ]);

  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`Chỉnh sửa: ${ticket.title}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Ticket", href: "/tickets" },
          { label: ticket.title, href: `/tickets/${ticket.id}` },
          { label: "Chỉnh sửa" },
        ]}
      />
      <TicketForm
        mode="edit"
        ticketId={ticket.id}
        companies={companies}
        staff={staff}
        defaultValues={{
          title: ticket.title,
          code: ticket.code ?? "",
          company_id: ticket.company_id,
          description: ticket.description ?? "",
          priority: ticket.priority,
          status: ticket.status,
          assignee_id: ticket.assignee_id,
          attachments: ticket.attachments ?? [],
        }}
      />
    </div>
  );
}
