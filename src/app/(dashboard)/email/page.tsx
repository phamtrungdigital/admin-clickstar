import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle, Mail, Plus } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listEmailLogs,
  listEmailTemplates,
  type EmailLogListItem,
  type EmailTemplateListItem,
} from "@/lib/queries/email";
import { requireInternalPage, canManageCustomers } from "@/lib/auth/guards";

export const metadata = { title: "Email | Portal.Clickstar.vn" };

export default async function EmailPage() {
  const profile = await requireInternalPage();
  const canManage = canManageCustomers(profile);

  let templates: EmailTemplateListItem[] = [];
  let logsResult: Awaited<ReturnType<typeof listEmailLogs>> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 30,
  };
  let loadError: string | null = null;
  try {
    [templates, logsResult] = await Promise.all([
      listEmailTemplates(),
      listEmailLogs({ pageSize: 30 }),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Không tải được dữ liệu";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email"
        description="Template + log gửi email transactional qua Resend. Trigger tự động khi có sự kiện (ticket update, báo cáo duyệt, onboarding khách)."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Email" },
        ]}
        actions={
          canManage ? (
            <Link
              href="/email/templates/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-blue-600 px-4 text-white hover:bg-blue-700",
              )}
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo template
            </Link>
          ) : null
        }
      />

      {loadError ? (
        <ErrorPanel message={loadError} />
      ) : (
        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">
              Templates ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="logs">
              Lịch sử gửi ({logsResult.total})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="templates" className="mt-4">
            <TemplatesPanel templates={templates} canManage={canManage} />
          </TabsContent>
          <TabsContent value="logs" className="mt-4">
            <LogsPanel logs={logsResult.rows} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function TemplatesPanel({
  templates,
  canManage,
}: {
  templates: EmailTemplateListItem[];
  canManage: boolean;
}) {
  if (templates.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Chưa có template"
        description={
          canManage
            ? "Bấm \"Tạo template\" để soạn email mẫu cho ticket / báo cáo / onboarding."
            : "Khi Manager+ tạo template email, danh sách sẽ hiện ở đây."
        }
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead>Mã</TableHead>
            <TableHead>Tiêu đề</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Cập nhật</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                {canManage ? (
                  <Link
                    href={`/email/templates/${t.id}/edit`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    {t.name}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-900">{t.name}</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-slate-500">
                {t.code}
              </TableCell>
              <TableCell className="max-w-sm truncate text-sm text-slate-700">
                {t.subject}
              </TableCell>
              <TableCell>
                {t.is_active ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Hoạt động
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                    Tắt
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {format(new Date(t.updated_at), "dd/MM/yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  sending: "bg-blue-50 text-blue-700 ring-blue-200",
  sent: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
  bounced: "bg-rose-50 text-rose-700 ring-rose-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ gửi",
  sending: "Đang gửi",
  sent: "Đã gửi",
  delivered: "Đã nhận",
  failed: "Thất bại",
  bounced: "Bounce",
};

function LogsPanel({ logs }: { logs: EmailLogListItem[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Chưa có email nào được gửi"
        description="Sau khi cài Resend API key + tạo template, email gửi qua hệ thống sẽ hiện ở đây."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Người nhận</TableHead>
            <TableHead>Tiêu đề</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-sm text-slate-500">
                {format(new Date(row.created_at), "dd/MM HH:mm")}
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {row.recipient_email}
              </TableCell>
              <TableCell className="max-w-sm truncate text-sm text-slate-700">
                {row.subject}
              </TableCell>
              <TableCell className="font-mono text-xs text-slate-500">
                {row.template?.code ?? "—"}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                    STATUS_TONE[row.status] ??
                      "bg-slate-100 text-slate-700 ring-slate-200",
                  )}
                  title={row.error_message ?? undefined}
                >
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
        <div>
          <h3 className="text-sm font-semibold text-red-900">
            Không tải được dữ liệu
          </h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
        </div>
      </div>
    </div>
  );
}
