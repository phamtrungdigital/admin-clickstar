import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  ExternalLink,
  FileSignature,
  FolderOpen,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Receipt,
  Ticket,
  User,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { CompanyStatusBadge } from "@/components/dashboard/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCustomerById } from "@/lib/queries/customers";

export const metadata = { title: "Chi tiết khách hàng | Portal.Clickstar.vn" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await getCustomerById(id).catch(() => null);
  if (!customer) notFound();

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
            <TabsList className="bg-white border border-slate-200 p-1">
              <TabsTrigger value="info">Thông tin</TabsTrigger>
              <TabsTrigger value="contracts">Hợp đồng</TabsTrigger>
              <TabsTrigger value="services">Dịch vụ</TabsTrigger>
              <TabsTrigger value="documents">Tài liệu</TabsTrigger>
              <TabsTrigger value="tickets">Ticket</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-4">
              <InfoCard customer={customer} />
            </TabsContent>
            <TabsContent value="contracts" className="mt-4">
              <ComingSoonTab title="Hợp đồng" icon={FileSignature} phase="2" />
            </TabsContent>
            <TabsContent value="services" className="mt-4">
              <ComingSoonTab title="Dịch vụ đang dùng" icon={Package} phase="2" />
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <ComingSoonTab title="Tài liệu" icon={FolderOpen} phase="2" />
            </TabsContent>
            <TabsContent value="tickets" className="mt-4">
              <ComingSoonTab title="Ticket" icon={Ticket} phase="2" />
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
