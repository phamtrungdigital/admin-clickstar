import { cn } from "@/lib/utils";

/**
 * FormSection — wrapper card chuẩn cho mọi form section.
 *
 * Trước đây 6+ form (customer, ticket, contract, service, settings,
 * user, ...) tự định nghĩa lại `function FormSection` y hệt nhau với
 * markup `rounded-xl border-slate-200 p-6` + header. Giờ gom 1 chỗ —
 * sau muốn tweak (ví dụ shadow nhẹ, đổi border tone) chỉ sửa file này.
 *
 * Style 2026-05-04 v2: border slate-200/70 (nhẹ hơn cho cảm giác sang),
 * title 15px tracking-tight, description leading-relaxed text-[13px].
 *
 * Ví dụ:
 *   <FormSection title="Thông tin cơ bản" description="...">
 *     <div className="grid gap-5 md:grid-cols-2"> ... </div>
 *   </FormSection>
 */
export function FormSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Nội dung phụ ở góc trên-phải (ví dụ nút "Thêm dòng"). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/70 bg-white p-6",
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
          {description && (
            <p className="text-[13px] leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
