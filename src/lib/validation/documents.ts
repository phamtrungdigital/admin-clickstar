import { z } from "zod";
import type { DocumentKind, DocumentVisibility } from "@/lib/database.types";

const trimmed = z.string().trim();

export const DOCUMENT_KINDS = [
  "contract",
  "addendum",
  "acceptance",
  "brief",
  "report",
  "design",
  "ad_creative",
  "seo",
  "other",
] as const satisfies readonly DocumentKind[];

export const DOCUMENT_VISIBILITIES = [
  "internal",
  "shared",
  "public",
] as const satisfies readonly DocumentVisibility[];

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  contract: "Hợp đồng",
  addendum: "Phụ lục",
  acceptance: "Biên bản nghiệm thu",
  brief: "Brief",
  report: "Báo cáo",
  design: "File thiết kế",
  ad_creative: "Tài liệu quảng cáo",
  seo: "Tài liệu SEO",
  other: "Khác",
};

export const DOCUMENT_VISIBILITY_LABEL: Record<DocumentVisibility, string> = {
  internal: "Nội bộ",
  shared: "Chia sẻ với khách",
  public: "Công khai",
};

// Accept "", null, or uuid; normalize empty string to null
const optionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .nullable()
  .transform((v) => (v && v !== "" ? v : null));

const optionalText = (max: number) =>
  z
    .union([trimmed.max(max), z.null()])
    .nullable()
    .transform((v) => (v && v !== "" ? v : null));

export const createDocumentSchema = z
  .object({
    company_id: optionalUuid,
    contract_id: optionalUuid,
    project_id: optionalUuid,
    ticket_id: optionalUuid,
    kind: z.enum(DOCUMENT_KINDS),
    name: trimmed.min(2, "Tên tài liệu tối thiểu 2 ký tự").max(255),
    description: optionalText(500),
    visibility: z.enum(DOCUMENT_VISIBILITIES),
    storage_path: trimmed.min(1, "Thiếu đường dẫn file"),
    mime_type: optionalText(255),
    size_bytes: z.number().int().nonnegative().nullable(),
  })
  .refine(
    (v) => v.company_id !== null || v.visibility !== "shared",
    {
      path: ["visibility"],
      message:
        "Tài liệu nội bộ Clickstar (không gắn khách hàng) không thể đặt quyền 'Chia sẻ với khách'.",
    },
  );
export type CreateDocumentInput = z.input<typeof createDocumentSchema>;
export type CreateDocumentParsed = z.output<typeof createDocumentSchema>;

export const updateDocumentSchema = z
  .object({
    name: trimmed.min(2).max(255),
    description: optionalText(500),
    kind: z.enum(DOCUMENT_KINDS),
    visibility: z.enum(DOCUMENT_VISIBILITIES),
    company_id: optionalUuid,
    contract_id: optionalUuid,
    project_id: optionalUuid,
  })
  .refine(
    (v) => v.company_id !== null || v.visibility !== "shared",
    {
      path: ["visibility"],
      message:
        "Tài liệu nội bộ không thể đặt quyền 'Chia sẻ với khách'.",
    },
  );
export type UpdateDocumentInput = z.input<typeof updateDocumentSchema>;
export type UpdateDocumentParsed = z.output<typeof updateDocumentSchema>;

export const setDocumentVisibilitySchema = z.object({
  visibility: z.enum(DOCUMENT_VISIBILITIES),
});
export type SetDocumentVisibilityInput = z.infer<
  typeof setDocumentVisibilitySchema
>;

/** Where the file lives in Storage. Files for a customer go under
 *  `companies/<id>/documents/...`; files with no owning company go
 *  under `internal/...`. The storage RLS policy validates both. */
export function buildDocumentStoragePath(
  companyId: string | null,
  filename: string,
): string {
  const ext = (filename.split(".").pop() || "bin").toLowerCase();
  const uuid = crypto.randomUUID();
  return companyId
    ? `companies/${companyId}/documents/${uuid}.${ext}`
    : `internal/${uuid}.${ext}`;
}
