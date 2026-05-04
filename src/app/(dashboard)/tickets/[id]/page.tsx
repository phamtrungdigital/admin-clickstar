import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Building2, Pencil, User } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/tickets/ticket-badges";
import { TicketAttachmentsDisplay } from "@/components/tickets/ticket-attachments-display";
import { getTicketById } from "@/lib/queries/tickets";
import { listTicketComments } from "@/lib/queries/ticket-comments";
import { TicketComments } from "@/components/tickets/ticket-comments";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import type { TicketAttachment } from "@/lib/database.types";

export const metadata = { title: "Chi tiết ticket | Portal.Clickstar.vn" };

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ id: currentUserId, profile }, ticket, comments] = await Promise.all([
    getCurrentUser(),
    getTicketById(id).catch(() => null),
    listTicketComments(id).catch(() => []),
  ]);
  if (!ticket) notFound();
  const canSeeAssignee = isInternal(profile);
  const isInternalUser = isInternal(profile);

  // Pre-sign attachment URLs (cả attachments của ticket lẫn của comments)
  // server-side để client khỏi round-trip.
  const ticketAttachments = ticket.attachments ?? [];
  const commentAttachments: TicketAttachment[] = comments.flatMap(
    (c) => (c.attachments as TicketAttachment[] | null) ?? [],
  );
  const allPaths = Array.from(
    new Set(
      [...ticketAttachments, ...commentAttachments].map((a) => a.path),
    ),
  );
  const urls: Record<string, string> = {};
  if (allPaths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrls(allPaths, 60 * 60);
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) urls[item.path] = item.signedUrl;
    }
  }
  const attachments = ticketAttachments;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={ticket.title}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Ticket", href: "/tickets" },
          { label: ticket.title },
        ]}
        actions={
          <>
            <Link
              href="/tickets"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-4",
              )}
            >
              Quay lại
            </Link>
            <Link
              href={`/tickets/${ticket.id}/edit`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-blue-600 px-4 text-white hover:bg-blue-700",
              )}
            >
              <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <TicketStatusBadge status={ticket.status} />
        <TicketPriorityBadge priority={ticket.priority} />
        {ticket.code && (
          <span className="font-mono text-xs text-slate-500">{ticket.code}</span>
        )}
        <span className="text-xs text-slate-400">
          Tạo {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
              Mô tả
            </h3>
            {ticket.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {ticket.description}
              </p>
            ) : (
              <p className="text-sm text-slate-400">Chưa có mô tả.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
              Tệp đính kèm
            </h3>
            <TicketAttachmentsDisplay attachments={attachments} urls={urls} />
          </div>

          <TicketComments
            ticketId={ticket.id}
            ticketStatus={ticket.status}
            comments={comments}
            attachmentUrls={urls}
            currentUserId={currentUserId}
            isInternalUser={isInternalUser}
            companyId={ticket.company_id}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              Thông tin
            </h3>
            <dl className="space-y-3 text-sm">
              <Row
                icon={Building2}
                label="Khách hàng"
                value={
                  ticket.company ? (
                    <Link
                      href={`/customers/${ticket.company.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {ticket.company.name}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              {canSeeAssignee && (
                <Row
                  icon={User}
                  label="Phụ trách"
                  value={ticket.assignee?.full_name ?? "Chưa phân công"}
                />
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Lịch sử
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Tạo lúc</dt>
                <dd className="text-slate-800">
                  {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Cập nhật</dt>
                <dd className="text-slate-800">
                  {format(new Date(ticket.updated_at), "dd/MM/yyyy HH:mm")}
                </dd>
              </div>
              {ticket.closed_at && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Đóng lúc</dt>
                  <dd className="text-slate-800">
                    {format(new Date(ticket.closed_at), "dd/MM/yyyy HH:mm")}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-sm font-medium text-slate-800 text-right">{value}</dd>
      </div>
    </div>
  );
}
