import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  ExternalLink,
  FileSignature,
  FolderKanban,
  FolderOpen,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Ticket,
  User,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { CompanyStatusBadge } from "@/components/dashboard/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCustomerById, listCompanyMembers } from "@/lib/queries/customers";
import { listContracts } from "@/lib/queries/contracts";
import { listProjects } from "@/lib/queries/projects";
import { listDocuments } from "@/lib/queries/documents";
import { listTickets } from "@/lib/queries/tickets";
import { MembersTab } from "@/components/customers/members-tab";
import {
  CONTRACT_STATUS_OPTIONS,
} from "@/lib/validation/contracts";
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_VISIBILITY_LABEL,
} from "@/lib/validation/documents";
import {
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
} from "@/lib/validation/tickets";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canSeeContracts } from "@/lib/auth/guards";

export const metadata = { title: "Chi tiết khách hàng | Portal.Clickstar.vn" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await getCustomerById(id).catch(() => null);
  if (!customer) notFound();
  const { profile } = await getCurrentUser();
  const showContracts = canSeeContracts(profile);

  const emptyResult = { rows: [], total: 0, page: 1, pageSize: 50 };
  const [
    members,
    contractsResult,
    projectsResult,
    documentsResult,
    ticketsResult,
  ] = await Promise.all([
    listCompanyMembers(customer.id).catch(() => []),
    // Skip the contract roundtrip entirely when staff/support — they
    // don't see the tab, no point asking RLS to filter rows out.
    showContracts
      ? listContracts({ company_id: customer.id, pageSize: 50 }).catch(
          () => emptyResult,
        )
      : Promise.resolve(emptyResult),
    listProjects({ company_id: customer.id, pageSize: 50 }).catch(
      () => emptyResult,
    ),
    listDocuments({ company_id: customer.id, pageSize: 50 }).catch(
      () => emptyResult,
    ),
    listTickets({ company_id: customer.id, pageSize: 50 }).catch(
      () => emptyResult,
    ),
  ]);
  const contracts = contractsResult.rows;
  const projects = projectsResult.rows;
  const documents = documentsResult.rows;
  const tickets = ticketsResult.rows;

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Khách hàng", href: "/customers" },
          { label: customer.name },
        ]}
        actions={
          <>
            <Link
              href="/customers"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}
            >
              Quay lại
            </Link>
            <Link
              href={`/customers/${customer.id}/edit`}
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
        <CompanyStatusBadge status={customer.status} />
        {customer.code && (
          <span className="font-mono text-xs text-slate-500">{customer.code}</span>
        )}
        <span className="text-xs text-slate-400">
          Tạo {format(new Date(customer.created_at), "dd/MM/yyyy HH:mm")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="info" className="w-full">
            <TabsList>
              <TabsTrigger value="info">Thông tin</TabsTrigger>
              <TabsTrigger value="members">Tài khoản</TabsTrigger>
              {showContracts && (
                <TabsTrigger value="contracts">
                  Hợp đồng
                  {contracts.length > 0 && ` (${contracts.length})`}
                </TabsTrigger>
              )}
              <TabsTrigger value="projects">
                Dự án
                {projects.length > 0 && ` (${projects.length})`}
              </TabsTrigger>
              <TabsTrigger value="services">Dịch vụ</TabsTrigger>
              <TabsTrigger value="documents">
                Tài liệu
                {documents.length > 0 && ` (${documents.length})`}
              </TabsTrigger>
              <TabsTrigger value="tickets">
                Ticket
                {tickets.length > 0 && ` (${tickets.length})`}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-4">
              <InfoCard customer={customer} />
            </TabsContent>
            <TabsContent value="members" className="mt-4">
              <MembersTab companyId={customer.id} members={members} />
            </TabsContent>
            {showContracts && (
              <TabsContent value="contracts" className="mt-4">
                <ContractsTab companyId={customer.id} contracts={contracts} />
              </TabsContent>
            )}
            <TabsContent value="projects" className="mt-4">
              <ProjectsTab projects={projects} />
            </TabsContent>
            <TabsContent value="services" className="mt-4">
              <ServicesTab services={customer.services} />
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <DocumentsTab companyId={customer.id} documents={documents} />
            </TabsContent>
            <TabsContent value="tickets" className="mt-4">
              <TicketsTab
                companyId={customer.id}
                companyName={customer.name}
                tickets={tickets}
              />
            </TabsContent>
          </Tabs>
        </div>

        <SidePanel customer={customer} />
      </div>
    </div>
  );
}

function InfoCard({ customer }: { customer: Awaited<ReturnType<typeof getCustomerById>> }) {
  if (!customer) return null;
  const items: Array<{ label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }> }> = [
    { label: "Tên doanh nghiệp", value: customer.name, icon: Building2 },
    { label: "Người đại diện", value: customer.representative ?? <Empty />, icon: User },
    {
      label: "Email",
      value: customer.email ? (
        <a href={`mailto:${customer.email}`} className="text-blue-700 hover:underline">
          {customer.email}
        </a>
      ) : (
        <Empty />
      ),
      icon: Mail,
    },
    {
      label: "Số điện thoại",
      value: customer.phone ? (
        <a href={`tel:${customer.phone}`} className="text-slate-700">
          {customer.phone}
        </a>
      ) : (
        <Empty />
      ),
      icon: Phone,
    },
    {
      label: "Website",
      value: customer.website ? (
        <a
          href={customer.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
        >
          {customer.website.replace(/^https?:\/\//, "")}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <Empty />
      ),
      icon: ExternalLink,
    },
    { label: "Ngành nghề", value: customer.industry ?? <Empty />, icon: Building2 },
    { label: "Mã số thuế", value: customer.tax_code ?? <Empty />, icon: Receipt },
    { label: "Địa chỉ", value: customer.address ?? <Empty />, icon: MapPin },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <dl className="grid gap-x-6 gap-y-4 p-6 md:grid-cols-2">
        {items.map((item) => (
          <InfoRow key={item.label} {...item} />
        ))}
      </dl>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-sm text-slate-800 break-words">{value}</dd>
      </div>
    </div>
  );
}

function Empty() {
  return <span className="text-slate-400">—</span>;
}

function SidePanel({ customer }: { customer: Awaited<ReturnType<typeof getCustomerById>> }) {
  if (!customer) return null;

  return (
    <div className="space-y-4">
      <SidePanelCard title="Người phụ trách">
        {customer.assignments.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa phân công</p>
        ) : (
          <ul className="space-y-3">
            {customer.assignments.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                  {(a.manager?.full_name ?? "?")
                    .split(" ")
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(-2)
                    .join("")
                    .toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {a.manager?.full_name ?? "(chưa đặt tên)"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ASSIGNMENT_LABEL[a.role] ?? a.role}
                    {a.is_primary && (
                      <span
                        className={cn(
                          "ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                          "bg-blue-50 text-blue-700",
                        )}
                      >
                        Chính
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SidePanelCard>

      <SidePanelCard title="Cập nhật">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Người tạo</dt>
            <dd className="text-slate-800">
              {customer.creator?.full_name ?? (
                <span className="text-slate-400">—</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Tạo lúc</dt>
            <dd className="text-slate-800">
              {format(new Date(customer.created_at), "dd/MM/yyyy HH:mm")}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Cập nhật</dt>
            <dd className="text-slate-800">
              {format(new Date(customer.updated_at), "dd/MM/yyyy HH:mm")}
            </dd>
          </div>
        </dl>
      </SidePanelCard>
    </div>
  );
}

function SidePanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function ContractsTab({
  companyId,
  contracts,
}: {
  companyId: string;
  contracts: Awaited<ReturnType<typeof listContracts>>["rows"];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          Hợp đồng của khách hàng này
        </h3>
        <Link
          href={`/contracts/new?company=${companyId}`}
          className={cn(
            buttonVariants({ size: "sm" }),
            "bg-blue-600 text-white hover:bg-blue-700",
          )}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Thêm hợp đồng
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
          <FileSignature className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            Chưa có hợp đồng nào với khách hàng này.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {contracts.map((c) => {
            const statusOpt = CONTRACT_STATUS_OPTIONS.find(
              (o) => o.value === c.status,
            );
            return (
              <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                  <FileSignature className="h-4 w-4 text-slate-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/contracts/${c.id}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {c.code ? `${c.code} · ` : ""}
                    {c.service_count} dịch vụ
                    {c.signed_at
                      ? ` · ký ${format(new Date(c.signed_at), "dd/MM/yyyy")}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                    statusOpt?.tone === "blue" && "bg-blue-50 text-blue-700 ring-blue-200",
                    statusOpt?.tone === "amber" && "bg-amber-50 text-amber-700 ring-amber-200",
                    statusOpt?.tone === "emerald" && "bg-emerald-50 text-emerald-700 ring-emerald-200",
                    statusOpt?.tone === "rose" && "bg-rose-50 text-rose-700 ring-rose-200",
                    (!statusOpt || statusOpt.tone === "slate") &&
                      "bg-slate-100 text-slate-700 ring-slate-200",
                  )}
                >
                  {statusOpt?.label ?? c.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectsTab({
  projects,
}: {
  projects: Awaited<ReturnType<typeof listProjects>>["rows"];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          Dự án của khách hàng này
        </h3>
        <p className="text-xs text-slate-500">
          Để thêm dự án mới, mở hợp đồng tương ứng và bấm “Triển khai từ
          template”.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            Chưa có dự án nào.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                <FolderKanban className="h-4 w-4 text-slate-500" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/projects/${p.id}`}
                  className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700"
                >
                  {p.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {p.contract?.name ? `${p.contract.name} · ` : ""}
                  {p.task_count} task
                  {p.template ? ` · template ${p.template.name}` : ""}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600">
                {p.progress_percent ?? 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentsTab({
  companyId,
  documents,
}: {
  companyId: string;
  documents: Awaited<ReturnType<typeof listDocuments>>["rows"];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          Tài liệu của khách hàng này
        </h3>
        <Link
          href={`/documents/new?company=${companyId}`}
          className={cn(
            buttonVariants({ size: "sm" }),
            "bg-blue-600 text-white hover:bg-blue-700",
          )}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Upload tài liệu
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            Chưa có tài liệu cho khách hàng này.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                <FolderOpen className="h-4 w-4 text-slate-500" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/documents/${d.id}`}
                  className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700"
                >
                  {d.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {DOCUMENT_KIND_LABEL[d.kind]} ·{" "}
                  {format(new Date(d.created_at), "dd/MM/yyyy")}
                  {d.size_bytes ? ` · ${formatBytes(d.size_bytes)}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                  d.visibility === "shared" &&
                    "bg-emerald-50 text-emerald-700 ring-emerald-200",
                  d.visibility === "public" &&
                    "bg-blue-50 text-blue-700 ring-blue-200",
                  d.visibility === "internal" &&
                    "bg-slate-100 text-slate-700 ring-slate-200",
                )}
              >
                {DOCUMENT_VISIBILITY_LABEL[d.visibility]}
              </span>
              <DocumentRowActions
                documentId={d.id}
                visibility={d.visibility}
                canManage
                companyName={d.company?.name ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketsTab({
  companyId,
  companyName,
  tickets,
}: {
  companyId: string;
  companyName: string;
  tickets: Awaited<ReturnType<typeof listTickets>>["rows"];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          Ticket của khách hàng này
        </h3>
        <Link
          href={`/tickets/new?company=${companyId}`}
          className={cn(
            buttonVariants({ size: "sm" }),
            "bg-blue-600 text-white hover:bg-blue-700",
          )}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Tạo ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
          <Ticket className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            {companyName} chưa có ticket nào.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tickets.map((t) => {
            const statusOpt = TICKET_STATUS_OPTIONS.find(
              (o) => o.value === t.status,
            );
            const priorityOpt = TICKET_PRIORITY_OPTIONS.find(
              (o) => o.value === t.priority,
            );
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                  <Ticket className="h-4 w-4 text-slate-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tickets/${t.id}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700"
                  >
                    {t.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {t.code ? `${t.code} · ` : ""}
                    {priorityOpt?.label ?? t.priority}
                    {" · "}
                    {format(new Date(t.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                    t.status === "new" &&
                      "bg-blue-50 text-blue-700 ring-blue-200",
                    t.status === "in_progress" &&
                      "bg-amber-50 text-amber-700 ring-amber-200",
                    t.status === "awaiting_customer" &&
                      "bg-violet-50 text-violet-700 ring-violet-200",
                    t.status === "resolved" &&
                      "bg-emerald-50 text-emerald-700 ring-emerald-200",
                    t.status === "closed" &&
                      "bg-slate-100 text-slate-700 ring-slate-200",
                  )}
                >
                  {statusOpt?.label ?? t.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function ServicesTab({
  services,
}: {
  services: Array<{ id: string; name: string; category: string | null }>;
}) {
  if (services.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Package className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          Chưa gắn dịch vụ
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Bấm <strong>Chỉnh sửa</strong> ở góc trên để tích chọn dịch vụ khách
          hàng đang sử dụng.
        </p>
      </div>
    );
  }

  const grouped = new Map<string, typeof services>();
  for (const s of services) {
    const key = s.category || "Chưa phân loại";
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
      {[...grouped.entries()].map(([category, items]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {category}
          </p>
          <div className="flex flex-wrap gap-2">
            {items.map((s) => (
              <Link
                key={s.id}
                href={`/services/${s.id}`}
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComingSoonTab({
  title,
  icon: Icon,
  phase,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-slate-300" />
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Hoàn thiện ở Phase {phase} theo lộ trình MVP.
      </p>
    </div>
  );
}

const ASSIGNMENT_LABEL: Record<string, string> = {
  account_manager: "Account Manager",
  implementer: "Triển khai",
  support: "Hỗ trợ",
  accountant: "Kế toán",
};
