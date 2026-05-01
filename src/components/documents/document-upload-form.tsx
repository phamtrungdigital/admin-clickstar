"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createDocumentAndRedirect } from "@/app/(dashboard)/documents/actions";
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KINDS,
  DOCUMENT_VISIBILITIES,
  DOCUMENT_VISIBILITY_LABEL,
  createDocumentSchema,
  type CreateDocumentInput,
} from "@/lib/validation/documents";
import type { DocumentKind, DocumentVisibility } from "@/lib/database.types";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — documents trên Storage

export type CompanyOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string; company_id: string };
export type ContractOption = {
  id: string;
  code: string | null;
  company_id: string;
};

export function DocumentUploadForm({
  companies,
  projects,
  contracts,
  defaultValues,
}: {
  companies: CompanyOption[];
  projects: ProjectOption[];
  contracts: ContractOption[];
  defaultValues?: Partial<CreateDocumentInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CreateDocumentInput>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: {
      company_id: defaultValues?.company_id ?? "",
      contract_id: defaultValues?.contract_id ?? null,
      project_id: defaultValues?.project_id ?? null,
      ticket_id: defaultValues?.ticket_id ?? null,
      kind: defaultValues?.kind ?? "other",
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      visibility: defaultValues?.visibility ?? "internal",
      storage_path: defaultValues?.storage_path ?? "",
      mime_type: defaultValues?.mime_type ?? "",
      size_bytes: defaultValues?.size_bytes ?? 0,
    },
  });

  const watchedCompanyId = watch("company_id");
  const watchedStoragePath = watch("storage_path");

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.company_id === watchedCompanyId),
    [projects, watchedCompanyId],
  );
  const filteredContracts = useMemo(
    () => contracts.filter((c) => c.company_id === watchedCompanyId),
    [contracts, watchedCompanyId],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      toast.error(`File quá ${MAX_BYTES / 1024 / 1024} MB`);
      return;
    }
    if (!watchedCompanyId) {
      toast.error("Vui lòng chọn khách hàng trước khi upload");
      return;
    }

    setFile(picked);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (picked.name.split(".").pop() || "bin").toLowerCase();
      const path = `companies/${watchedCompanyId}/documents/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(path, picked, {
          contentType: picked.type || "application/octet-stream",
          upsert: false,
          cacheControl: "3600",
        });
      if (error) {
        toast.error(`Upload lỗi: ${error.message}`);
        setFile(null);
        return;
      }
      setValue("storage_path", path, { shouldValidate: true });
      setValue("mime_type", picked.type || "application/octet-stream");
      setValue("size_bytes", picked.size);
      // Default the document name to the original filename if user hasn't typed one yet.
      if (!watch("name")) setValue("name", picked.name);
      toast.success("Đã upload file");
    } finally {
      setUploading(false);
    }
  };

  const removeUploadedFile = async () => {
    if (!watchedStoragePath) {
      setFile(null);
      return;
    }
    const supabase = createClient();
    await supabase.storage
      .from("documents")
      .remove([watchedStoragePath])
      .catch(() => {});
    setFile(null);
    setValue("storage_path", "");
    setValue("mime_type", "");
    setValue("size_bytes", 0);
  };

  const onSubmit = (values: CreateDocumentInput) => {
    if (!values.storage_path) {
      toast.error("Vui lòng upload file trước");
      return;
    }
    startTransition(async () => {
      const result = await createDocumentAndRedirect(values);
      if (result && !result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [k, m] of Object.entries(result.fieldErrors)) {
            setError(k as keyof CreateDocumentInput, { message: m });
          }
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Khách hàng *
            </Label>
            <Controller
              control={control}
              name="company_id"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => {
                    if (!v) return;
                    field.onChange(v);
                    setValue("project_id", null);
                    setValue("contract_id", null);
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "mt-1.5 w-full",
                      errors.company_id && "border-red-500",
                    )}
                  >
                    <SelectValue placeholder="Chọn khách hàng">
                      {(value: string | null) => {
                        if (!value) return null;
                        return (
                          companies.find((c) => c.id === value)?.name ?? value
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.company_id && (
              <p className="mt-1 text-xs text-red-600">
                {errors.company_id.message}
              </p>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700">Loại *</Label>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => v && field.onChange(v as DocumentKind)}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        value
                          ? DOCUMENT_KIND_LABEL[value as DocumentKind]
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {DOCUMENT_KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Dự án (tuỳ chọn)
            </Label>
            <Controller
              control={control}
              name="project_id"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) =>
                    field.onChange(v === "none" ? null : v)
                  }
                  disabled={!watchedCompanyId}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue>
                      {(value: string | null) => {
                        if (!value || value === "none") return "— Không gán —";
                        return (
                          filteredProjects.find((p) => p.id === value)?.name ??
                          value
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Không gán —</SelectItem>
                    {filteredProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Hợp đồng (tuỳ chọn)
            </Label>
            <Controller
              control={control}
              name="contract_id"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) =>
                    field.onChange(v === "none" ? null : v)
                  }
                  disabled={!watchedCompanyId}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue>
                      {(value: string | null) => {
                        if (!value || value === "none") return "— Không gán —";
                        const c = filteredContracts.find((x) => x.id === value);
                        return c?.code ?? value;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Không gán —</SelectItem>
                    {filteredContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code ?? c.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium text-slate-700">Tên tài liệu *</Label>
          <Input
            className={cn("mt-1.5", errors.name && "border-red-500")}
            placeholder="VD: Hợp đồng dịch vụ SEO ký 04/2026"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium text-slate-700">
            Mô tả ngắn
          </Label>
          <Textarea
            rows={2}
            className="mt-1.5"
            placeholder="Ghi chú nhanh về tài liệu này..."
            {...register("description")}
          />
        </div>

        <div>
          <Label className="text-sm font-medium text-slate-700">
            Quyền chia sẻ
          </Label>
          <Controller
            control={control}
            name="visibility"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) =>
                  v && field.onChange(v as DocumentVisibility)
                }
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      value
                        ? DOCUMENT_VISIBILITY_LABEL[value as DocumentVisibility]
                        : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_VISIBILITIES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {DOCUMENT_VISIBILITY_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="mt-1 text-xs text-slate-500">
            <strong>Nội bộ:</strong> chỉ Clickstar thấy. <strong>Chia sẻ:</strong>{" "}
            khách hàng đăng nhập thấy. <strong>Công khai:</strong> bất kỳ ai có
            link đều xem được.
          </p>
        </div>
      </div>

      {/* File uploader */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <Label className="text-sm font-medium text-slate-700">
          Tệp tài liệu *
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.png,.jpg,.jpeg,.webp,.gif,.svg"
        />
        {!watchedStoragePath ? (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !watchedCompanyId}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang upload...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Chọn file
                </>
              )}
            </Button>
            <span className="text-xs text-slate-500">
              Tối đa 50 MB. {!watchedCompanyId && "Hãy chọn khách hàng trước."}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <FileText className="h-5 w-5 text-slate-500" />
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium text-slate-900">
                {file?.name ?? watchedStoragePath.split("/").pop()}
              </p>
              {watch("size_bytes") ? (
                <p className="text-xs text-slate-500">
                  {formatBytes(watch("size_bytes") ?? 0)}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeUploadedFile}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {errors.storage_path && (
          <p className="text-xs text-red-600">{errors.storage_path.message}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending || uploading}
        >
          Huỷ
        </Button>
        <Button
          type="submit"
          disabled={isPending || uploading || !watchedStoragePath}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Lưu tài liệu
        </Button>
      </div>
    </form>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
