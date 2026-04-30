import { Construction } from "lucide-react";
import { PageHeader, type Crumb } from "@/components/dashboard/page-header";

export function ComingSoon({
  title,
  description,
  breadcrumb,
  phase,
}: {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  phase?: "B" | "C" | "2" | "3" | "4";
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} breadcrumb={breadcrumb} />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Construction className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Đang phát triển</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          Module này sẽ được hoàn thiện ở
          {phase ? ` Phase ${phase}` : " các giai đoạn tiếp theo"} theo lộ trình MVP.
        </p>
      </div>
    </div>
  );
}
