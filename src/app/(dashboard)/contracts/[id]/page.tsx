import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  FileSignature,
  FolderOpen,
  Pencil,
  Wallet,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
import { AttachmentLink } from "@/components/contracts/attachment-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getContractById } from "@/lib/queries/contracts";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";

export const metadata = { title: "Chi tiết hợp đồng | Portal.Clickstar.vn" };

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await getCurrentUser();
  const canManage = isInternal(profile);
  const contract = await getContractById(id).catch(() => null);
  if (!contract) notFound();

  const servicesTotal = contract.services.reduce(
    (sum, s) => sum + Number(s.unit_price) * Number(s.quantity),
    0,
  );
  const vatAmount = (Number(contract.total_value) * Number(contract.vat_percent)) / 100;
  const grandTotal = Number(contract.total_value) + vatAmount;

  return (
    <div className="space-y-6">
      <PageHeader
        title={contract.name}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Hợp đồng", href: "/contracts" },
          { label: contract.name },
        ]}
        actions={
          <>
            <Link
              href="/contracts"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-4",
              )}
            >
              Quay lại
            </Link>
            {canManage && (
              <Link
                href={`/contracts/${contract.id}/edit`}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-blue-600 px-4 text-white hover:bg-blue-700",
                )}
              >
                <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ContractStatusBadge status={contract.status} />
        {contract.code && (
          <span className="font-mono text-xs text-slate-500">{contract.code}</span>
        )}
        <span className="text-xs text-slate-400">
          Cập nhật {format(new Date(contract.updated_at), "dd/MM/yyyy HH:mm")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="bg-white border border-slate-200 p-1">
              <TabsTrigger value="info">Thông tin</TabsTrigger>
              <TabsTrigger value="services">Dịch vụ</TabsTrigger>
              <TabsTrigger value="attachment">Tệp đính kèm</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-4">
              <InfoCard contract={contract} />
            </TabsContent>
            <TabsContent value="services" className="mt-4">
              <ServicesTab
                services={contract.services}
                servicesTotal={servicesTotal}
                canManage={canManage}
              />
            </TabsContent>
            <TabsContent value="attachment" className="mt-4">
              <AttachmentTab
                contractId={contract.id}
                url={contract.attachment_url}
                filename={contract.attachment_filename}
                canManage={canManage}
              />
            </TabsContent>
          </Tabs>
        </div>

        <SidePanel
          contract={contract}
          servicesTotal={servicesTotal}
          vatAmount={vatAmount}
          grandTotal={grandTotal}
        />
      </div>
    </div>
  );
}

function InfoCard({
  contract,
}: {
  contract: NonNullable<Awaited<ReturnType<typeof getContractById>>>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <dl className="grid gap-x-6 gap-y-4 p-6 md:grid-cols-2">
        <Row
          icon={Building2}
          label="Khách hàng"
          value={
            contract.company ? (
              <Link
                href={`/customers/${contract.company.id}`}
                className="text-blue-700 hover:underline"
              >
                {contract.company.name}
              </Link>
            ) : (
              <Empty />
            )
          }
        />
        <Row
          icon={FileSignature}
          label="Mã hợp đồng"
          value={contract.code ?? <Empty />}
        />
        <Row
          icon={CalendarCheck}
          label="Ngày ký"
          value={
            contract.signed_at
              ? format(new Date(contract.signed_at), "dd/MM/yyyy")
              : <Empty />
          }
        />
        <Row
          icon={Calendar}
          label="Bắt đầu"
          value={
            contract.starts_at
              ? format(new Date(contract.starts_at), "dd/MM/yyyy")
              : <Empty />
          }
        />
        <Row
          icon={CalendarClock}
          label="Kết thúc"
          value={
            contract.ends_at
              ? format(new Date(contract.ends_at), "dd/MM/yyyy")
              : <Empty />
          }
        />
        <Row
          icon={Wallet}
          label="VAT"
          value={`${Number(contract.vat_percent)}%`}
        />
        {contract.notes && (
          <div className="md:col-span-2 mt-2">
            <dt className="text-xs font-medium text-slate-500">Ghi chú</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {contract.notes}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function ServicesTab({
  services,
  servicesTotal,
  canManage,
}: {
  services: NonNullable<Awaited<ReturnType<typeof getContractById>>>["services"];
  servicesTotal: number;
  canManage: boolean;
}) {
  if (services.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <FileSignature className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          Chưa gắn dịch vụ
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {canManage
            ? "Sửa hợp đồng để thêm các dịch vụ Clickstar cung cấp theo hợp đồng này."
            : "Hợp đồng này chưa có dịch vụ nào được khai báo."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dịch vụ</TableHead>
            <TableHead className="text-right">Đơn giá</TableHead>
            <TableHead className="text-right">Số lượng</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">
                    {s.service?.name ?? "—"}
                  </span>
                  {s.service?.category && (
                    <span className="text-xs text-slate-500">{s.service.category}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right text-sm text-slate-700">
                {Number(s.unit_price).toLocaleString("vi-VN")}
              </TableCell>
              <TableCell className="text-right text-sm text-slate-700">
                {Number(s.quantity).toLocaleString("vi-VN")}
              </TableCell>
              <TableCell className="text-right font-medium text-slate-900">
                {(Number(s.unit_price) * Number(s.quantity)).toLocaleString("vi-VN")}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-slate-50">
            <TableCell colSpan={3} className="text-right text-sm font-medium text-slate-700">
              Tổng tạm tính dịch vụ
            </TableCell>
            <TableCell className="text-right font-semibold text-slate-900">
              {servicesTotal.toLocaleString("vi-VN")} ₫
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function AttachmentTab({
  contractId,
  url,
  filename,
  canManage,
}: {
  contractId: string;
  url: string | null;
  filename: string | null;
  canManage: boolean;
}) {
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          Chưa có tệp đính kèm
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {canManage
            ? "Sửa hợp đồng để upload PDF hoặc dán đường dẫn online (Google Drive, Dropbox…)."
            : "Hợp đồng này hiện chưa được đính kèm tệp PDF."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="mb-3 text-sm text-slate-600">
        Tệp hợp đồng. Bấm để tải xuống hoặc mở trong tab mới.
      </p>
      <AttachmentLink contractId={contractId} filename={filename} url={url} />
    </div>
  );
}

function SidePanel({
  contract,
  servicesTotal,
  vatAmount,
  grandTotal,
}: {
  contract: NonNullable<Awaited<ReturnType<typeof getContractById>>>;
  servicesTotal: number;
  vatAmount: number;
  grandTotal: number;
}) {
  return (
    <div className="space-y-4">
      <SidePanelCard title="Tổng quan giá trị">
        <dl className="space-y-2.5 text-sm">
          <Money label="Giá trị hợp đồng" value={Number(contract.total_value)} />
          <Money
            label={`VAT (${Number(contract.vat_percent)}%)`}
            value={vatAmount}
          />
          <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
            <dt className="font-semibold text-slate-900">Tổng cộng</dt>
            <dd className="font-semibold text-blue-700">
              {grandTotal.toLocaleString("vi-VN")} ₫
            </dd>
          </div>
          <Money label="Tổng tạm tính dịch vụ" value={servicesTotal} muted />
        </dl>
      </SidePanelCard>

      <SidePanelCard title="Lịch sử">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Tạo lúc</dt>
            <dd className="text-slate-800">
              {format(new Date(contract.created_at), "dd/MM/yyyy HH:mm")}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Cập nhật</dt>
            <dd className="text-slate-800">
              {format(new Date(contract.updated_at), "dd/MM/yyyy HH:mm")}
            </dd>
          </div>
        </dl>
      </SidePanelCard>
    </div>
  );
}

function Money({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn("text-slate-500", muted && "text-slate-400")}>{label}</dt>
      <dd className={cn("font-medium text-slate-800", muted && "text-slate-500")}>
        {value.toLocaleString("vi-VN")} ₫
      </dd>
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
