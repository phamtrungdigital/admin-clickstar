"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleDot,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  COMPANY_STATUS_OPTIONS,
  createCompanySchema,
  type CreateCompanyInput,
} from "@/lib/validation/companies";
import {
  CONTRACT_STATUS_OPTIONS,
  createContractSchema,
  type ContractServiceLineInput,
  type CreateContractInput,
} from "@/lib/validation/contracts";
import {
  ContractServicesEditor,
  type TemplateOption,
} from "@/components/contracts/contract-services-editor";
import type { ServiceOption } from "@/lib/queries/contracts";
import { onboardCustomerAndRedirect } from "@/app/(dashboard)/customers/actions";
import type { ServicePickOption } from "@/components/customers/customer-form";

const STEPS = [
  { id: 1, title: "Khách hàng", icon: Building2 },
  { id: 2, title: "Hợp đồng", icon: FileText },
  { id: 3, title: "Dịch vụ & Template", icon: Sparkles },
] as const;

const NO_MANAGER = "__none__";

export type OnboardWizardProps = {
  staff: Array<{ id: string; full_name: string; internal_role: string | null }>;
  customerServices: ServicePickOption[];
  /** Services + templates dùng cho contract step (catalogue active). */
  contractServices: ServiceOption[];
  templates: TemplateOption[];
  currentUserId: string;
  canChooseManager: boolean;
};

type CustomerState = CreateCompanyInput;
type ContractState = Omit<CreateContractInput, "company_id" | "services">;

export function OnboardWizard({
  staff,
  customerServices,
  contractServices,
  templates,
  currentUserId,
  canChooseManager,
}: OnboardWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, startTransition] = useTransition();

  const [customer, setCustomer] = useState<CustomerState>({
    name: "",
    code: "",
    status: "new",
    industry: "",
    website: "",
    representative: "",
    email: "",
    phone: "",
    address: "",
    tax_code: "",
    primary_account_manager_id: currentUserId,
    service_ids: [],
  });

  const [includeContract, setIncludeContract] = useState(true);
  const [contract, setContract] = useState<ContractState>({
    name: "",
    code: "",
    status: "draft",
    signed_at: "",
    starts_at: "",
    ends_at: "",
    notes: "",
    attachment_url: "",
    attachment_filename: "",
  });
  const [serviceLines, setServiceLines] = useState<ContractServiceLineInput[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const errorFor = (key: string) => errors[key];

  // Step 1 validation —————————————————————————————
  const validateStep1 = () => {
    const result = createCompanySchema.safeParse(customer);
    if (result.success) {
      setErrors({});
      return true;
    }
    const e: Record<string, string> = {};
    for (const issue of result.error.issues) {
      e[`customer.${issue.path.join(".")}`] = issue.message;
    }
    setErrors(e);
    toast.error("Vui lòng kiểm tra thông tin khách hàng");
    return false;
  };

  // Step 2 validation (chỉ chạy nếu user bật contract) —————————————
  const validateStep2 = () => {
    if (!includeContract) {
      setErrors({});
      return true;
    }
    // Test với dữ liệu giả company_id để zod pass — server sẽ inject thật
    const result = createContractSchema.safeParse({
      ...contract,
      company_id: "00000000-0000-0000-0000-000000000000",
      services: [],
    });
    if (result.success) {
      setErrors({});
      return true;
    }
    const e: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const k = issue.path.join(".");
      if (k === "company_id" || k === "services") continue;
      e[`contract.${k}`] = issue.message;
    }
    if (Object.keys(e).length === 0) {
      setErrors({});
      return true;
    }
    setErrors(e);
    toast.error("Vui lòng kiểm tra thông tin hợp đồng");
    return false;
  };

  // Submit —————————————————————————————
  const submit = () => {
    // Final validate from server schema by re-running step checks
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (includeContract && !validateStep2()) {
      setStep(2);
      return;
    }

    startTransition(async () => {
      const result = await onboardCustomerAndRedirect({
        customer,
        contract: includeContract
          ? { ...contract, services: serviceLines }
          : null,
      });
      // redirect on success — only reach here on error
      if (result && !result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          const e: Record<string, string> = {};
          for (const [k, m] of Object.entries(result.fieldErrors)) e[k] = m;
          setErrors(e);
          // Hint user to step containing the bad field
          const bad = Object.keys(e)[0];
          if (bad?.startsWith("customer.")) setStep(1);
          else if (bad?.startsWith("contract.services")) setStep(3);
          else if (bad?.startsWith("contract.")) setStep(2);
        }
      }
      if (result?.ok && result.data?.contractWarning) {
        toast.warning(result.data.contractWarning);
      }
    });
  };

  const goNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  return (
    <div className="space-y-6">
      <Stepper currentStep={step} onJump={(s) => setStep(s)} />

      {step === 1 && (
        <Step1Customer
          value={customer}
          onChange={setCustomer}
          errorFor={errorFor}
          staff={staff}
          customerServices={customerServices}
          canChooseManager={canChooseManager}
        />
      )}

      {step === 2 && (
        <Step2Contract
          enabled={includeContract}
          onToggle={setIncludeContract}
          value={contract}
          onChange={setContract}
          errorFor={errorFor}
        />
      )}

      {step === 3 && (
        <Step3Services
          enabled={includeContract}
          services={serviceLines}
          onServicesChange={setServiceLines}
          options={contractServices}
          templates={templates}
          customerSummary={customer}
          contractSummary={contract}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/customers")}
          disabled={submitting}
        >
          Huỷ
        </Button>
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={submitting}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Quay lại
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Tiếp theo <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="mr-1.5 h-4 w-4" />
              Tạo khách hàng
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stepper
// ────────────────────────────────────────────────────────────────────────────

function Stepper({
  currentStep,
  onJump,
}: {
  currentStep: 1 | 2 | 3;
  onJump: (step: 1 | 2 | 3) => void;
}) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isCurrent = s.id === currentStep;
        const isDone = s.id < currentStep;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => isDone && onJump(s.id)}
              disabled={!isDone}
              className={cn(
                "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isCurrent &&
                  "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
                isDone &&
                  "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 cursor-pointer",
                !isCurrent &&
                  !isDone &&
                  "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
                  isCurrent && "bg-blue-600 text-white",
                  isDone && "bg-emerald-600 text-white",
                  !isCurrent && !isDone && "bg-slate-200 text-slate-500",
                )}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <CircleDot className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 text-left">
                <p className="text-xs uppercase tracking-wide opacity-75">
                  Bước {s.id}
                </p>
                <p className="truncate">{s.title}</p>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 1: Customer
// ────────────────────────────────────────────────────────────────────────────

function Step1Customer({
  value,
  onChange,
  errorFor,
  staff,
  customerServices,
  canChooseManager,
}: {
  value: CustomerState;
  onChange: (next: CustomerState) => void;
  errorFor: (key: string) => string | undefined;
  staff: OnboardWizardProps["staff"];
  customerServices: ServicePickOption[];
  canChooseManager: boolean;
}) {
  const update = <K extends keyof CustomerState>(k: K, v: CustomerState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <Section
      title="Thông tin khách hàng"
      description="Thông tin định danh + người phụ trách. Bắt buộc để bước sang Hợp đồng."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Tên doanh nghiệp *"
          error={errorFor("customer.name")}
        >
          <Input
            value={value.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="VD: Công ty TNHH ABC"
          />
        </Field>
        <Field label="Mã khách hàng" error={errorFor("customer.code")}>
          <Input
            value={value.code ?? ""}
            onChange={(e) => update("code", e.target.value)}
            placeholder="Tự sinh nếu để trống"
          />
        </Field>
        <Field label="Trạng thái *" error={errorFor("customer.status")}>
          <Select
            value={value.status}
            onValueChange={(v) =>
              v && update("status", v as CustomerState["status"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn trạng thái">
                {(v: string | null) =>
                  v
                    ? COMPANY_STATUS_OPTIONS.find((o) => o.value === v)?.label
                    : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ngành nghề" error={errorFor("customer.industry")}>
          <Input
            value={value.industry ?? ""}
            onChange={(e) => update("industry", e.target.value)}
            placeholder="VD: Thương mại điện tử"
          />
        </Field>
        <Field label="Email" error={errorFor("customer.email")}>
          <Input
            type="email"
            value={value.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
            placeholder="contact@khachhang.com"
          />
        </Field>
        <Field label="Số điện thoại" error={errorFor("customer.phone")}>
          <Input
            value={value.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="0987 654 321"
          />
        </Field>
        <Field label="Mã số thuế" error={errorFor("customer.tax_code")}>
          <Input
            value={value.tax_code ?? ""}
            onChange={(e) => update("tax_code", e.target.value)}
          />
        </Field>
        <Field label="Người đại diện" error={errorFor("customer.representative")}>
          <Input
            value={value.representative ?? ""}
            onChange={(e) => update("representative", e.target.value)}
          />
        </Field>
        <Field
          label="Địa chỉ"
          error={errorFor("customer.address")}
          className="md:col-span-2"
        >
          <Textarea
            rows={2}
            value={value.address ?? ""}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
          />
        </Field>
      </div>

      <div className="mt-6">
        <Field label="Account Manager chính">
          <Select
            value={value.primary_account_manager_id ?? NO_MANAGER}
            onValueChange={(v) =>
              update(
                "primary_account_manager_id",
                v === NO_MANAGER ? null : v,
              )
            }
            disabled={!canChooseManager}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Chưa phân công">
                {(v: string | null) => {
                  if (!v || v === NO_MANAGER) return "Chưa phân công";
                  return staff.find((s) => s.id === v)?.full_name ?? v;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MANAGER}>Chưa phân công</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name || "(chưa đặt tên)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!canChooseManager && (
            <p className="mt-1.5 text-xs text-slate-500">
              Bạn được mặc định là Account Manager của khách hàng này.
            </p>
          )}
        </Field>
      </div>

      {customerServices.length > 0 && (
        <div className="mt-6">
          <Label className="text-sm font-medium text-slate-700">
            Dịch vụ KH đang dùng (gắn vào hồ sơ KH)
          </Label>
          <p className="mt-1 text-xs text-slate-500">
            Đây là tag đánh dấu vào hồ sơ khách hàng. Dịch vụ thực tế triển
            khai sẽ chọn ở bước 3.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {customerServices.map((s) => {
              const checked = (value.service_ids ?? []).includes(s.id);
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-sm transition-colors",
                    checked
                      ? "border-blue-300 bg-blue-50/50"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => {
                      const cur = new Set(value.service_ids ?? []);
                      if (cur.has(s.id)) cur.delete(s.id);
                      else cur.add(s.id);
                      update("service_ids", Array.from(cur));
                    }}
                    className="mt-0.5"
                  />
                  <span className="font-medium text-slate-900">{s.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </Section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2: Contract
// ────────────────────────────────────────────────────────────────────────────

function Step2Contract({
  enabled,
  onToggle,
  value,
  onChange,
  errorFor,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  value: ContractState;
  onChange: (next: ContractState) => void;
  errorFor: (key: string) => string | undefined;
}) {
  const update = <K extends keyof ContractState>(k: K, v: ContractState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <Section
      title="Hợp đồng đầu tiên"
      description="Thông tin pháp lý của hợp đồng vừa ký với khách hàng. Có thể bỏ qua nếu chưa có HĐ chính thức."
      headerSlot={
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <Checkbox
            checked={enabled}
            onCheckedChange={(v) => onToggle(Boolean(v))}
          />
          Tạo hợp đồng cùng lúc
        </label>
      }
    >
      {!enabled ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
          Đã bỏ qua bước Hợp đồng. Có thể tạo HĐ sau từ trang chi tiết khách
          hàng.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Tên hợp đồng *"
            error={errorFor("contract.name")}
            className="md:col-span-2"
          >
            <Input
              value={value.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="VD: HĐ DV SEO Q2 2026 — ABC"
            />
          </Field>
          <Field label="Mã hợp đồng" error={errorFor("contract.code")}>
            <Input
              value={value.code ?? ""}
              onChange={(e) => update("code", e.target.value)}
              placeholder="VD: HD-2026-001"
            />
          </Field>
          <Field label="Trạng thái *" error={errorFor("contract.status")}>
            <Select
              value={value.status}
              onValueChange={(v) =>
                v && update("status", v as ContractState["status"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn trạng thái">
                  {(v: string | null) =>
                    v
                      ? CONTRACT_STATUS_OPTIONS.find((o) => o.value === v)?.label
                      : null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ngày ký" error={errorFor("contract.signed_at")}>
            <Input
              type="date"
              value={value.signed_at ?? ""}
              onChange={(e) => update("signed_at", e.target.value)}
            />
          </Field>
          <Field label="Ngày bắt đầu" error={errorFor("contract.starts_at")}>
            <Input
              type="date"
              value={value.starts_at ?? ""}
              onChange={(e) => update("starts_at", e.target.value)}
            />
          </Field>
          <Field label="Ngày kết thúc" error={errorFor("contract.ends_at")}>
            <Input
              type="date"
              value={value.ends_at ?? ""}
              onChange={(e) => update("ends_at", e.target.value)}
            />
          </Field>
          <Field
            label="Ghi chú"
            error={errorFor("contract.notes")}
            className="md:col-span-2"
          >
            <Textarea
              rows={3}
              value={value.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Ghi chú nội bộ về hợp đồng..."
            />
          </Field>
          <p className="md:col-span-2 text-xs text-slate-500">
            File PDF hợp đồng có thể upload sau từ trang chi tiết hợp đồng.
          </p>
        </div>
      )}
    </Section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3: Services + Templates
// ────────────────────────────────────────────────────────────────────────────

function Step3Services({
  enabled,
  services,
  onServicesChange,
  options,
  templates,
  customerSummary,
  contractSummary,
}: {
  enabled: boolean;
  services: ContractServiceLineInput[];
  onServicesChange: (next: ContractServiceLineInput[]) => void;
  options: ServiceOption[];
  templates: TemplateOption[];
  customerSummary: CustomerState;
  contractSummary: ContractState;
}) {
  const addRow = () => {
    onServicesChange([
      ...services,
      {
        service_id: "",
        template_id: null,
        starts_at: "",
        ends_at: "",
        notes: "",
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <Section
        title="Dịch vụ triển khai & Template"
        description={
          enabled
            ? "Mỗi dịch vụ trong hợp đồng có thể chọn template — hệ thống sẽ tự fork thành dự án (project) ngay khi lưu."
            : "Đã bỏ qua bước Hợp đồng — không có dịch vụ triển khai để cấu hình."
        }
      >
        {!enabled ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
            Quay lại bước 2 để tạo hợp đồng nếu cần dùng template.
          </div>
        ) : (
          <>
            <ContractServicesEditor
              services={services}
              options={options}
              templates={templates}
              onChange={onServicesChange}
            />
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                + Thêm dịch vụ
              </Button>
            </div>
          </>
        )}
      </Section>

      <Section title="Tổng kết" description="Kiểm tra lại trước khi tạo.">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <ReviewItem
            label="Khách hàng"
            value={customerSummary.name || "(chưa nhập tên)"}
          />
          <ReviewItem
            label="Trạng thái KH"
            value={
              COMPANY_STATUS_OPTIONS.find(
                (o) => o.value === customerSummary.status,
              )?.label ?? customerSummary.status
            }
          />
          {enabled && (
            <>
              <ReviewItem
                label="Hợp đồng"
                value={contractSummary.name || "(chưa nhập tên HĐ)"}
              />
              <ReviewItem
                label="Trạng thái HĐ"
                value={
                  CONTRACT_STATUS_OPTIONS.find(
                    (o) => o.value === contractSummary.status,
                  )?.label ?? contractSummary.status
                }
              />
              <ReviewItem
                label="Số dịch vụ"
                value={`${services.length} dòng${
                  services.filter((s) => s.template_id).length > 0
                    ? ` · ${services.filter((s) => s.template_id).length} template sẽ fork thành project`
                    : ""
                }`}
              />
            </>
          )}
        </dl>
      </Section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  headerSlot,
  children,
}: {
  title: string;
  description?: string;
  headerSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
        {headerSlot}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/40 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

